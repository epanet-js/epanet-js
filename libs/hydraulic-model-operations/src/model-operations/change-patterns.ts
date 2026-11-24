import { Patterns, isPatternInUse } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { changeSet, replacePatterns } from "../change-sets";

type InputData = Patterns;

export const changePatterns: ModelOperation<InputData> = (model, patterns) => {
  for (const [id, pattern] of model.patterns) {
    if (!patterns.has(id) && isPatternInUse(model, id)) {
      throw new Error(`Cannot remove pattern ${pattern.label}; it is in use`);
    }
  }
  return changeSet(model, "changePatterns", [replacePatterns(patterns)]);
};
