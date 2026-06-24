import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Lock } from "lucide-react";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import {
  ChevronRightIcon,
  ConnectivityTraceIcon,
  OrphanNodeIcon,
  PipesCrossinIcon,
  ProximityCheckIcon,
  WarningIcon,
} from "src/icons";
import { OrphanAssets } from "./orphan-assets";
import { useUserTracking } from "src/infra/user-tracking";
import { CheckType } from "./common";
import { ProximityAnomalies } from "./proximity-anomalies";
import { CrossingPipes } from "./crossing-pipes";
import { ConnectivityTrace } from "./connectivity-trace";
import { ModelAttributesValidation } from "./model-attributes-validation";
import { EarlyAccessBadge } from "src/components/early-access-badge";
import { useEarlyAccess } from "src/hooks/use-early-access";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { usePermissions } from "src/hooks/use-permissions";
import { usePaywall } from "src/hooks/use-paywall";
import { dialogAtom } from "src/state/dialog";
import { selectedReviewCheckAtom } from "src/state/network-review";

export function NetworkReview() {
  const [selectedReviewCheck, setSelectedReviewCheck] = useAtom(
    selectedReviewCheckAtom,
  );
  const [checkType, setCheckType] = useState<CheckType | null>(
    () => selectedReviewCheck,
  );

  useEffect(
    function deepLinkToSelectedCheck() {
      if (selectedReviewCheck !== null) {
        setCheckType(selectedReviewCheck);
      }
    },
    [selectedReviewCheck],
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

const baseChecks = [
  CheckType.orphanAssets,
  CheckType.proximityAnomalies,
  CheckType.crossingPipes,
  CheckType.connectivityTrace,
];

function NetworkReviewSummary({
  onClick,
}: {
  onClick: (check: CheckType) => void;
}) {
  const translate = useTranslate();
  const isValidationFlagOn = useFeatureFlag("FLAG_ATTRIBUTES_VALIDATION");
  const { canValidateModelAttributes } = usePermissions();
  const setDialog = useSetAtom(dialogAtom);
  const modelAttributesValidationPaywall = usePaywall(
    "modelAttributesValidation",
  );

  const allChecks = useMemo(() => {
    if (isValidationFlagOn) {
      return [...baseChecks, CheckType.modelAttributesValidation];
    }
    return baseChecks;
  }, [isValidationFlagOn]);

  const isLocked = useCallback(
    (checkType: CheckType) =>
      checkType === CheckType.modelAttributesValidation &&
      !canValidateModelAttributes,
    [canValidateModelAttributes],
  );

  const openUpgrade = useCallback(() => {
    if (modelAttributesValidationPaywall)
      setDialog(modelAttributesValidationPaywall);
  }, [modelAttributesValidationPaywall, setDialog]);

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
    [selectedCheckType, onClick, allChecks],
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
      <div className="flex-auto px-1">
        {allChecks.map((checkType) => (
          <ReviewCheck
            key={checkType}
            checkType={checkType}
            onClick={onClick}
            isSelected={selectedCheckType === checkType}
            requiresEarlyAccess={
              checkType !== CheckType.modelAttributesValidation
            }
            isLocked={isLocked(checkType)}
            onLocked={openUpgrade}
          />
        ))}
      </div>
    </div>
  );
}

const iconsByCheckType = {
  [CheckType.orphanAssets]: <OrphanNodeIcon />,
  [CheckType.connectivityTrace]: <ConnectivityTraceIcon />,
  [CheckType.proximityAnomalies]: <ProximityCheckIcon />,
  [CheckType.crossingPipes]: <PipesCrossinIcon />,
  [CheckType.modelAttributesValidation]: <WarningIcon />,
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
  requiresEarlyAccess = true,
  isLocked = false,
  onLocked,
}: {
  checkType: CheckType;
  onClick: (checkType: CheckType) => void;
  isEnabled?: boolean;
  isSelected: boolean;
  requiresEarlyAccess?: boolean;
  isLocked?: boolean;
  onLocked?: () => void;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const onlyEarlyAccess = useEarlyAccess();

  const label = translate(labelKeyByCheckType[checkType]);

  const selectCheck = useCallback(() => {
    if (!isEnabled) return;
    if (isLocked) {
      onLocked?.();
      return;
    }
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
    isLocked,
    onLocked,
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
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 items-start p-2 pr-0 text-size-base w-full">
        <div className="pt-[.125rem]">{iconsByCheckType[checkType]}</div>
        <div className="flex flex-row gap-2 flex-wrap items-center">
          <div className="text-size-base font-bold text-left">{label}</div>
        </div>
        {isLocked ? (
          <div className="pt-[.125rem] text-subtle">
            <Lock size={16} />
          </div>
        ) : (
          isEnabled && (
            <div
              className={`pt-[.125rem] transition-opacity ${
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <ChevronRightIcon />
            </div>
          )
        )}
      </div>
    </Button>
  );
};
