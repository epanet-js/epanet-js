import { Pump } from "./asset-types/pump";
import { Tank } from "./asset-types/tank";
import { Valve } from "./asset-types/valve";
import type { CurveId } from "./curves";
import type { HydraulicModel } from "./hydraulic-model";

export const isCurveInUse = (
  hydraulicModel: HydraulicModel,
  curveId: CurveId,
): boolean => {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset instanceof Pump) {
      if (asset.curveId === curveId || asset.efficiencyCurveId === curveId)
        return true;
    } else if (asset instanceof Tank) {
      if (asset.volumeCurveId === curveId) return true;
    } else if (asset instanceof Valve) {
      if (asset.curveId === curveId) return true;
    }
  }
  return false;
};
