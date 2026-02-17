import { DemandPatterns } from "../demands";
import { ModelOperation } from "../model-operation";

type InputData = DemandPatterns;

export const changeDemandPatterns: ModelOperation<InputData> = (
  _model,
  patterns,
) => {
  return {
    note: "Change demand patterns",
    putDemands: { patterns },
  };
};
