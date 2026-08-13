import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import {
  ChevronRightIcon,
  ConnectivityTraceIcon,
  MissingAttributeIcon,
  OrphanNodeIcon,
  PipesCrossinIcon,
  ProximityCheckIcon,
  WarningIcon,
} from "src/icons";
import { OrphanAssets } from "./orphan-assets";
import { useUserTracking } from "src/infra/user-tracking";
import {
  CheckType,
  blockingChecks,
  BlockingCheckType,
} from "src/lib/network-review";
import { LoadingState } from "./common";
import { ProximityAnomalies } from "./proximity-anomalies";
import { CrossingPipes } from "./crossing-pipes";
import { ConnectivityTrace } from "./connectivity-trace";
import { ModelAttributesValidation } from "./model-attributes-validation";
import { EarlyAccessBadge } from "src/components/early-access-badge";
import { useEarlyAccess } from "src/hooks/use-early-access";
import {
  reviewResultsAtom,
  selectedReviewCheckAtom,
} from "src/state/network-review";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useReviewChecks } from "src/hooks/use-review-checks";

const LOADING_OVERLAY_DELAY_MS = 300;
const MIN_OVERLAY_VISIBLE_MS = 400;

// TEMPORARY: switch to compare row layouts, then keep the winner and delete
// the other two branches along with this constant.
//   growWhenIssues - the row only grows when a check has issues
//   growAlways     - every row reserves the second line, so heights never change
//   compact        - the row keeps its single-line height, content centred and
//                    tightened when a second line is present
type RowLayout = "growWhenIssues" | "growAlways" | "compact";
const rowLayout = (): RowLayout => "growWhenIssues";
const reservedDetailHeight = "h-5";
const compactRowHeight = "h-12";

const CheckRowDetail = ({
  detail,
  compact = false,
}: {
  detail: string;
  compact?: boolean;
}) => (
  <div
    className={`flex items-center gap-1 ${compact ? "mt-1 text-size-small leading-tight" : ""}`}
  >
    <span className="shrink-0 text-orange-500 dark:text-orange-400">
      <WarningIcon size={12} />
    </span>
    <span className="text-subtle truncate">{detail}</span>
  </div>
);

const CheckRowText = ({
  label,
  detail,
}: {
  label: string;
  detail: string | null;
}) => {
  if (rowLayout() === "growAlways") {
    return (
      <div className="min-w-0 text-left">
        <div className="text-size-base font-bold">{label}</div>
        <div className={`flex items-center ${reservedDetailHeight}`}>
          {detail !== null && <CheckRowDetail detail={detail} />}
        </div>
      </div>
    );
  }

  if (rowLayout() === "compact") {
    return (
      <div className="min-w-0 text-left">
        <div className="text-size-base font-bold leading-tight">{label}</div>
        {detail !== null && <CheckRowDetail detail={detail} compact />}
      </div>
    );
  }

  return (
    <div className="min-w-0 text-left">
      <div className="text-size-base font-bold">{label}</div>
      {detail !== null && <CheckRowDetail detail={detail} />}
    </div>
  );
};

const isBlockingCheck = (check: CheckType): check is BlockingCheckType =>
  (blockingChecks as readonly CheckType[]).includes(check);

export function NetworkReview() {
  const [selectedReviewCheck, setSelectedReviewCheck] = useAtom(
    selectedReviewCheckAtom,
  );
  const [checkType, setCheckType] = useState<CheckType | null>(() =>
    selectedReviewCheck === "summary" ? null : selectedReviewCheck,
  );

  useEffect(
    function deepLinkToSelectedCheck() {
      if (selectedReviewCheck === "summary") {
        setCheckType(null);
        setSelectedReviewCheck(null);
        return;
      }
      if (selectedReviewCheck !== null) {
        setCheckType(selectedReviewCheck);
      }
    },
    [selectedReviewCheck, setSelectedReviewCheck],
  );

  const goBackToSummary = useCallback(() => {
    setCheckType(null);
    setSelectedReviewCheck(null);
  }, [setSelectedReviewCheck]);

  switch (checkType) {
    case CheckType.orphanAssets:
      return <OrphanAssets onGoBack={goBackToSummary} />;
    case CheckType.proximityAnomalies:
      return <ProximityAnomalies onGoBack={goBackToSummary} />;
    case CheckType.crossingPipes:
      return <CrossingPipes onGoBack={goBackToSummary} />;
    case CheckType.connectivityTrace:
      return <ConnectivityTrace onGoBack={goBackToSummary} />;
    case CheckType.modelAttributesValidation:
      return <ModelAttributesValidation onGoBack={goBackToSummary} />;
    default:
      return (
        <NetworkReviewSummary
          onClick={(checkType: CheckType) => setCheckType(checkType)}
        />
      );
  }
}

const allChecks = [
  CheckType.orphanAssets,
  CheckType.proximityAnomalies,
  CheckType.crossingPipes,
  CheckType.connectivityTrace,
  CheckType.modelAttributesValidation,
];

function NetworkReviewSummary({
  onClick,
}: {
  onClick: (check: CheckType) => void;
}) {
  const translate = useTranslate();
  const isPreSimulationChecksOn = useFeatureFlag("FLAG_PRE_SIMULATION_CHECKS");
  const { ensureFresh } = useReviewChecks();
  const reviewResults = useAtomValue(reviewResultsAtom);
  const [isRunning, setIsRunning] = useState(false);

  const [selectedCheckType, setSelectedCheckType] = useState<CheckType | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(function autoFocusOnMount() {
    const timer = setTimeout(() => {
      containerRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const modelVersion = useAtomValue(stagingModelDerivedAtom).version;
  const overlayShownAt = useRef<number | null>(null);

  useEffect(
    function recomputeChecksWhenModelChanges() {
      if (!isPreSimulationChecksOn) return;

      const abortController = new AbortController();
      let hideOverlay: ReturnType<typeof setTimeout> | undefined;

      const showOverlay = setTimeout(() => {
        // Sticky across consecutive runs, so continuous editing measures the
        // minimum from when the overlay first appeared rather than restarting.
        if (overlayShownAt.current === null) {
          overlayShownAt.current = Date.now();
        }
        setIsRunning(true);
      }, LOADING_OVERLAY_DELAY_MS);

      const hide = () => {
        overlayShownAt.current = null;
        setIsRunning(false);
      };

      void ensureFresh({ signal: abortController.signal })
        .catch(() => {})
        .finally(() => {
          clearTimeout(showOverlay);
          if (abortController.signal.aborted) return;

          const shownAt = overlayShownAt.current;
          if (shownAt === null) return hide();

          const remaining = MIN_OVERLAY_VISIBLE_MS - (Date.now() - shownAt);
          if (remaining <= 0) return hide();

          hideOverlay = setTimeout(hide, remaining);
        });

      return () => {
        abortController.abort();
        clearTimeout(showOverlay);
        clearTimeout(hideOverlay);
      };
    },
    [isPreSimulationChecksOn, ensureFresh, modelVersion],
  );

  // Deliberately ignores the entry's model version: a recompute is already
  // under way, and blanking the count until it lands reads as a flash. The
  // last known count holds until the new one replaces it, and a new project
  // clears the cache outright.
  const issueCount = (checkType: CheckType): number => {
    if (!isPreSimulationChecksOn) return 0;
    if (!isBlockingCheck(checkType)) return 0;

    return reviewResults[checkType]?.issueCount ?? 0;
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = allChecks.findIndex(
        (check) => check === selectedCheckType,
      );

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, allChecks.length - 1);
          setSelectedCheckType(allChecks[nextIndex]);
          break;
        case "ArrowUp":
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          setSelectedCheckType(allChecks[prevIndex]);
          break;
        case "Enter":
          e.preventDefault();
          if (currentIndex === -1) break;
          const selectedCheck = allChecks[currentIndex];
          onClick(selectedCheck);
          break;

        case "Escape":
          e.preventDefault();
          setSelectedCheckType(null);
          break;
      }
    },
    [selectedCheckType, onClick],
  );

  return (
    <div
      ref={containerRef}
      className="flex-auto overflow-y-auto placemark-scrollbar"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="py-3 px-4 text-size-base font-bold text-default border-b w-full">
        <span>{translate("networkReview.title")}</span>
      </div>
      <div className="px-4 pt-3">
        <EarlyAccessBadge />
      </div>
      <div className="px-4 py-2 text-size-base">
        {translate("networkReview.description")}
      </div>
      <div className="relative flex-auto px-1">
        {allChecks.map((checkType) => (
          <ReviewCheck
            key={checkType}
            checkType={checkType}
            onClick={onClick}
            isSelected={selectedCheckType === checkType}
            issueCount={issueCount(checkType)}
            requiresEarlyAccess={
              checkType !== CheckType.modelAttributesValidation
            }
          />
        ))}
        {isRunning && <LoadingState overlay />}
      </div>
    </div>
  );
}

const iconsByCheckType = {
  [CheckType.orphanAssets]: <OrphanNodeIcon />,
  [CheckType.connectivityTrace]: <ConnectivityTraceIcon />,
  [CheckType.proximityAnomalies]: <ProximityCheckIcon />,
  [CheckType.crossingPipes]: <PipesCrossinIcon />,
  [CheckType.modelAttributesValidation]: <MissingAttributeIcon />,
};

const labelKeyByCheckType = {
  [CheckType.orphanAssets]: "networkReview.orphanAssets.title",
  [CheckType.connectivityTrace]: "networkReview.connectivityTrace.title",
  [CheckType.proximityAnomalies]: "networkReview.proximityAnomalies.title",
  [CheckType.crossingPipes]: "networkReview.crossingPipes.title",
  [CheckType.modelAttributesValidation]:
    "networkReview.modelAttributesValidation.title",
};

const ReviewCheck = ({
  onClick,
  checkType,
  isEnabled = true,
  isSelected,
  issueCount,
  requiresEarlyAccess = true,
}: {
  checkType: CheckType;
  onClick: (checkType: CheckType) => void;
  isEnabled?: boolean;
  isSelected: boolean;
  issueCount: number;
  requiresEarlyAccess?: boolean;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const onlyEarlyAccess = useEarlyAccess();

  const label = translate(labelKeyByCheckType[checkType]);

  const selectCheck = useCallback(() => {
    if (!isEnabled) return;
    const openCheck = () => {
      userTracking.capture({
        name: `networkReview.${checkType}.opened`,
      });
      onClick(checkType);
    };
    if (requiresEarlyAccess) {
      onlyEarlyAccess(openCheck);
    } else {
      openCheck();
    }
  }, [
    onClick,
    checkType,
    userTracking,
    isEnabled,
    onlyEarlyAccess,
    requiresEarlyAccess,
  ]);

  return (
    <Button
      onClick={selectCheck}
      variant={"quiet/list"}
      aria-label={label}
      aria-checked={isSelected}
      aria-expanded={isSelected ? true : false}
      className="group w-full"
      disabled={!isEnabled}
    >
      <div
        className={`grid grid-cols-[auto_1fr_auto] gap-x-2 items-start pr-0 text-size-base w-full ${
          rowLayout() === "compact"
            ? `px-2 content-center ${compactRowHeight}`
            : "p-2"
        }`}
      >
        <div className="pt-[.125rem]">{iconsByCheckType[checkType]}</div>
        <CheckRowText
          label={label}
          detail={
            issueCount > 0
              ? translate("networkReview.issuesFound", issueCount)
              : null
          }
        />
        {isEnabled && (
          <div
            className={`pt-[.125rem] transition-opacity ${
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <ChevronRightIcon />
          </div>
        )}
      </div>
    </Button>
  );
};
