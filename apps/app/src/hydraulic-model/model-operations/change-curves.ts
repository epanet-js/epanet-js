import { Curves } from "@epanet-js/hydraulic-model";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { changeSet, replaceCurves } from "../change-sets";

type InputData = {
  curves: Curves;
};

export const changeCurves: ModelOperation<InputData> = (model, { curves }) =>
  changeSet(model, "changeCurves", [replaceCurves(curves)]);

export const changeCurvesDeprecated: ModelOperationDeprecated<InputData> = (
  _model,
  { curves },
) => {
  return {
    note: "changeCurves",
    putCurves: curves,
  };
};
