import { Patterns } from "../patterns";
import { ModelOperation } from "../model-operation";

type InputData = Patterns;

export const changePatterns: ModelOperation<InputData> = (_model, patterns) => {
  return {
    note: "Change patterns",
    putPatterns: patterns,
  };
};
