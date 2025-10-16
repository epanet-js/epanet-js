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

  return (
    <div className="flex-auto overflow-y-auto placemark-scrollbar">
      <div className="py-3 px-4 w-full text-sm font-bold text-gray-900 dark:text-white border-b-2 border-gray-100">
        {translate("networkReview.title")}
      </div>
      <div className="px-4 py-2 text-sm">
        {translate("networkReview.description")}
      </div>
      <div className="flex-auto px-1">
        {isConnectivityTraceEnabled && (
          <ReviewCheck
            checkType={CheckType.connectivityTrace}
            onClick={onClick}
          />
        )}
        {isOrphanNodesEnabled && (
          <ReviewCheck checkType={CheckType.orphanAssets} onClick={onClick} />
        )}
        {isProximityAnomaliesEnabled && (
          <ReviewCheck
            checkType={CheckType.proximityAnomalies}
            onClick={onClick}
          />
        )}
        {isCrossingPipesEnabled && (
          <ReviewCheck checkType={CheckType.crossingPipes} onClick={onClick} />
        )}
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
}: {
  checkType: CheckType;
  onClick: (checkType: CheckType) => void;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();

  const label = translate(labelKeyByCheckType[checkType]);

  const selectCheck = useCallback(() => {
    userTracking.capture({
      name: `networkReview.${checkType}.opened`,
    });
    onClick(checkType);
  }, [onClick, checkType, userTracking]);

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
        <div className="text-sm font-bold text-left">{label}</div>
        <div className="pt-[.125rem] opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRightIcon />
        </div>
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
