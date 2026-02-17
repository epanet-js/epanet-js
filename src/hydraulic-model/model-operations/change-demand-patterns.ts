import { Patterns } from "../patterns";
import { ModelOperation } from "../model-operation";

type InputData = Patterns;

export const changeDemandPatterns: ModelOperation<InputData> = (
  _model,
  patterns,
) => {
  return {
    note: "Change demand patterns",
    putDemands: { patterns },
  };
};
