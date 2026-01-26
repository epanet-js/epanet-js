import type { HydraulicModel } from "src/hydraulic-model";
import type { Moment } from "src/lib/persistence/moment";

export type CapturedSnapshot = {
  moment: Moment;
  version: string;
};

export const captureModelSnapshot = (
  hydraulicModel: HydraulicModel,
): CapturedSnapshot => {
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
  return { moment, version: hydraulicModel.version };
};
