import { Curves, isCurveInUse } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { changeSet, replaceCurves } from "../change-sets";

type InputData = {
  curves: Curves;
};

export const changeCurves: ModelOperation<InputData> = (model, { curves }) => {
  for (const [id, curve] of model.curves) {
    if (!curves.has(id) && isCurveInUse(model, id)) {
      throw new Error(`Cannot remove curve ${curve.label}; it is in use`);
    }
  }
  return changeSet(model, "changeCurves", [replaceCurves(curves)]);
};
