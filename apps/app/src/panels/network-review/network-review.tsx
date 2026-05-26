import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import {
  ChevronRightIcon,
  ConnectivityTraceIcon,
  OrphanNodeIcon,
  PipesCrossinIcon,
  ProximityCheckIcon,
} from "src/icons";
import { OrphanAssets } from "./orphan-assets";
import { useUserTracking } from "src/infra/user-tracking";
import { CheckType } from "./common";
import { ProximityAnomalies } from "./proximity-anomalies";
import { CrossingPipes } from "./crossing-pipes";
import { ConnectivityTrace } from "./connectivity-trace";
import { EarlyAccessBadge } from "src/components/early-access-badge";
import { useEarlyAccess } from "src/hooks/use-early-access";

export function NetworkReview() {
  const [checkType, setCheckType] = useState<CheckType | null>(null);

  const goBackToSummary = useCallback(() => {
    setCheckType(null);
  }, []);

  switch (checkType) {
    case CheckType.orphanAssets:
      return <OrphanAssets onGoBack={goBackToSummary} />;
    case CheckType.proximityAnomalies:
      return <ProximityAnomalies onGoBack={goBackToSummary} />;
    case CheckType.crossingPipes:
      return <CrossingPipes onGoBack={goBackToSummary} />;
    case CheckType.connectivityTrace:
      return <ConnectivityTrace onGoBack={goBackToSummary} />;
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
];

function NetworkReviewSummary({
  onClick,
}: {
  onClick: (check: CheckType) => void;
}) {
  const translate = useTranslate();

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
    [selectedCheckType, onClick],
  );

  return (
    <div
      ref={containerRef}
      className="flex-auto overflow-y-auto placemark-scrollbar"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="py-3 px-4 text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 w-full">
        <span>{translate("networkReview.title")}</span>
      </div>
      <div className="px-4 pt-3">
        <EarlyAccessBadge />
      </div>
      <div className="px-4 py-2 text-sm">
        {translate("networkReview.description")}
      </div>
      <div className="flex-auto px-1">
        {allChecks.map((checkType) => (
          <ReviewCheck
            key={checkType}
            checkType={checkType}
            onClick={onClick}
            isSelected={selectedCheckType === checkType}
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
};

const labelKeyByCheckType = {
  [CheckType.orphanAssets]: "networkReview.orphanAssets.title",
  [CheckType.connectivityTrace]: "networkReview.connectivityTrace.title",
  [CheckType.proximityAnomalies]: "networkReview.proximityAnomalies.title",
  [CheckType.crossingPipes]: "networkReview.crossingPipes.title",
};

const ReviewCheck = ({
  onClick,
  checkType,
  isEnabled = true,
  isSelected,
}: {
  checkType: CheckType;
  onClick: (checkType: CheckType) => void;
  isEnabled?: boolean;
  isSelected: boolean;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const onlyEarlyAccess = useEarlyAccess();

  const label = translate(labelKeyByCheckType[checkType]);

  const selectCheck = useCallback(() => {
    if (!isEnabled) return;
    onlyEarlyAccess(() => {
      userTracking.capture({
        name: `networkReview.${checkType}.opened`,
      });
      onClick(checkType);
    });
  }, [onClick, checkType, userTracking, isEnabled, onlyEarlyAccess]);

  return (
    <Button
      onClick={selectCheck}
      variant={"quiet/list"}
      role="button"
      aria-label={label}
      aria-checked={isSelected}
      aria-expanded={isSelected ? true : false}
      className="group w-full"
      disabled={!isEnabled}
    >
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 items-start p-2 pr-0 text-sm w-full">
        <div className="pt-[.125rem]">{iconsByCheckType[checkType]}</div>
        <div className="flex flex-row gap-2 flex-wrap items-center">
          <div className="text-sm font-bold text-left">{label}</div>
        </div>
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
