import { ModelOperation } from "../model-operation";

type InputData = number;

export const changeDemandMultiplier: ModelOperation<InputData> = (
  _model,
  multiplier,
) => {
  return {
    note: "Change demand multiplier",
    putDemands: { multiplier },
  };
};
