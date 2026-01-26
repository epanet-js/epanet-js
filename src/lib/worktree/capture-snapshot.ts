import type { HydraulicModel } from "src/hydraulic-model";
import type { Moment } from "src/lib/persistence/moment";
import type { BaseModelSnapshot } from "./types";

export const captureModelSnapshot = (
  hydraulicModel: HydraulicModel,
): BaseModelSnapshot => {
  const moment: Moment = {
    note: "Scenario base snapshot",
    putAssets: [...hydraulicModel.assets.values()],
    deleteAssets: [],
    putDemands: hydraulicModel.demands,
    putEPSTiming: hydraulicModel.epsTiming,
    putControls: hydraulicModel.controls,
    putCustomerPoints: [...hydraulicModel.customerPoints.values()],
    putCurves: [...hydraulicModel.curves.values()],
  };
  return { moment, stateId: hydraulicModel.version };
};
