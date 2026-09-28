import { Patterns } from "@epanet-js/hydraulic-model";
import { ModelOperationDeprecated } from "../model-operation";

type InputData = Patterns;

export const changePatterns: ModelOperationDeprecated<InputData> = (
  _model,
  patterns,
) => {
  return {
    note: "Change patterns",
    putPatterns: patterns,
  };
};
