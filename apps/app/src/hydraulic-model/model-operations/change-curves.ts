import { Curves } from "@epanet-js/hydraulic-model";
import { ModelOperationDeprecated } from "../model-operation";

type InputData = {
  curves: Curves;
};

export const changeCurves: ModelOperationDeprecated<InputData> = (
  _model,
  { curves },
) => {
  return {
    note: "Change pump curves",
    putCurves: curves,
  };
};
