import { Patterns } from "@epanet-js/hydraulic-model";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { changeSet, replacePatterns } from "../change-sets";

type InputData = Patterns;

export const changePatterns: ModelOperation<InputData> = (model, patterns) =>
  changeSet(model, "Change patterns", [replacePatterns(patterns)]);

export const changePatternsDeprecated: ModelOperationDeprecated<InputData> = (
  _model,
  patterns,
) => {
  return {
    note: "Change patterns",
    putPatterns: patterns,
  };
};
