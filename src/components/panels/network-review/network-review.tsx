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
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { CheckType } from "./common";
import { ProximityAnomalies } from "./proximity-anomalies";
import { CrossingPipes } from "./crossing-pipes";
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
    default:
      return (
        <NetworkReviewSummary
          onClick={(checkType: CheckType) => setCheckType(checkType)}
        />
      );
  }
}

function NetworkReviewSummary({
  onClick,
}: {
  onClick: (check: CheckType) => void;
}) {
  const translate = useTranslate();
  const isOrphanNodesEnabled = useFeatureFlag("FLAG_ORPHAN_NODES");
  const isProximityAnomaliesEnabled = useFeatureFlag("FLAG_PROXIMITY_CHECK");
  const isConnectivityTraceEnabled = useFeatureFlag("FLAG_CONNECTIVITY_TRACE");
  const isCrossingPipesEnabled = useFeatureFlag("FLAG_CROSSING_PIPES");

  const allChecks = [
    { checkType: CheckType.orphanAssets, isEnabled: isOrphanNodesEnabled },
    {
      checkType: CheckType.proximityAnomalies,
      isEnabled: isProximityAnomaliesEnabled,
    },
    {
      checkType: CheckType.crossingPipes,
      isEnabled: isCrossingPipesEnabled,
    },
    {
      checkType: CheckType.connectivityTrace,
      isEnabled: isConnectivityTraceEnabled,
    },
  ];

  const enabledChecks = allChecks.filter((check) => check.isEnabled);
  const disabledChecks = allChecks.filter((check) => !check.isEnabled);

  const [selectedCheckType, setSelectedCheckType] = useState<CheckType>(
    CheckType.orphanAssets,
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
      if (enabledChecks.length === 0) return;

      const currentIndex = enabledChecks.findIndex(
        (check) => check.checkType === selectedCheckType,
      );

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          const nextIndex = Math.min(
            currentIndex + 1,
            enabledChecks.length - 1,
          );
          setSelectedCheckType(enabledChecks[nextIndex].checkType);
          break;
        case "ArrowUp":
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          setSelectedCheckType(enabledChecks[prevIndex].checkType);
          break;
        case "Enter":
          e.preventDefault();
          if (currentIndex === -1) break;
          const selectedCheck = enabledChecks[currentIndex];
          if (selectedCheck?.isEnabled) {
            onClick(selectedCheck.checkType);
            break;
          }
      }
    },
    [enabledChecks, selectedCheckType, onClick],
  );

  return (
    <div
      ref={containerRef}
      className="flex-auto overflow-y-auto placemark-scrollbar"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="py-3 px-4 w-full text-sm font-bold text-gray-900 dark:text-white border-b-2 border-gray-100 flex flex-row gap-2 justify-between items-center">
        <span>{translate("networkReview.title")}</span>
        <EarlyAccessBadge />
      </div>
      <div className="px-4 py-2 text-sm">
        {translate("networkReview.description")}
      </div>
      <div className="flex-auto px-1">
        {enabledChecks.map(({ checkType }) => (
          <ReviewCheck
            key={checkType}
            checkType={checkType}
            onClick={onClick}
            isEnabled={true}
            isSelected={selectedCheckType === checkType}
          />
        ))}
        <div className="uppercase text-gray-700 dark:text-gray-200 px-4 py-2 text-sm">
          {translate("comingSoon")}
        </div>
        {disabledChecks.map(({ checkType }) => (
          <ReviewCheck
            key={checkType}
            checkType={checkType}
            onClick={onClick}
            isEnabled={false}
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
  isEnabled,
  isSelected,
}: {
  checkType: CheckType;
  onClick: (checkType: CheckType) => void;
  isEnabled: boolean;
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
      <div
        className="grid gap-x-2 items-start p-2 pr-0 text-sm w-full"
        style={{
          gridTemplateColumns: "auto 1fr auto",
        }}
      >
        <div className="pt-[.125rem]">{iconsByCheckType[checkType]}</div>
        <div className="flex flex-row gap-2 flex-wrap items-center">
          <div className="text-sm font-bold text-left">{label}</div>
        </div>
        {isEnabled && (
          <div className="pt-[.125rem] opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRightIcon />
          </div>
        )}
      </div>
    </Button>
  );
};

export const useNetworkReviewEnabled = () => {
  const isOrphanNodesEnabled = useFeatureFlag("FLAG_ORPHAN_NODES");
  const isProximityAnomaliesEnabled = useFeatureFlag("FLAG_PROXIMITY_CHECK");
  const isConnectivityTraceEnabled = useFeatureFlag("FLAG_CONNECTIVITY_TRACE");
  const isCrossingPipesEnabled = useFeatureFlag("FLAG_CROSSING_PIPES");

  return (
    isOrphanNodesEnabled ||
    isProximityAnomaliesEnabled ||
    isConnectivityTraceEnabled ||
    isCrossingPipesEnabled
  );
};
