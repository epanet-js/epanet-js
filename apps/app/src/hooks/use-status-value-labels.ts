import { useMemo } from "react";
import type { AssetType } from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { STATUS_CLOSED, STATUS_OPEN } from "src/lib/asset-graph";

export const useStatusValueLabels = (
  assetType: AssetType,
  isStatus: boolean,
): Map<number, string> | null => {
  const translate = useTranslate();
  return useMemo(() => {
    if (!isStatus) return null;
    return assetType === "pump"
      ? new Map([
          [STATUS_CLOSED, translate("pump.off")],
          [STATUS_OPEN, translate("pump.on")],
        ])
      : new Map([
          [STATUS_CLOSED, translate("statusClosed")],
          [STATUS_OPEN, translate("statusOpen")],
        ]);
  }, [isStatus, assetType, translate]);
};
