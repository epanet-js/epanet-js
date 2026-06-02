import { Curves } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";

type InputData = {
  curves: Curves;
};

export const changeCurves: ModelOperation<InputData> = (_model, { curves }) => {
  return {
    note: "Change pump curves",
    putCurves: curves,
  };
};
