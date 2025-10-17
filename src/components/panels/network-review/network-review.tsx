import { useCallback, useState } from "react";
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
import { CommingSoonBadge } from "src/components/comming-soon-badge";

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

  return (
    <div className="flex-auto overflow-y-auto placemark-scrollbar">
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
          />
        ))}
        {disabledChecks.map(({ checkType }) => (
          <ReviewCheck
            key={checkType}
            checkType={checkType}
            onClick={onClick}
            isEnabled={false}
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
}: {
  checkType: CheckType;
  onClick: (checkType: CheckType) => void;
  isEnabled: boolean;
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
      variant={"quiet/mode"}
      role="button"
      aria-label={label}
      className="group w-full"
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
          {!isEnabled && <CommingSoonBadge />}
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
