import { Curves } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { changeSet, replaceCurves } from "../change-sets";

type InputData = {
  curves: Curves;
};

export const changeCurves: ModelOperation<InputData> = (model, { curves }) =>
  changeSet(model, "changeCurves", [replaceCurves(curves)]);
