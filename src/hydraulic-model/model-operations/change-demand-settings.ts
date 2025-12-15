import { Demands } from "../demands";
import { ModelOperation } from "../model-operation";

type InputData = {
  demandMultiplier: number;
};

export const changeDemandSettings: ModelOperation<InputData> = (
  { demands: currentDemands },
  { demandMultiplier },
) => {
  const demands: Demands = {
    multiplier: demandMultiplier,
    patterns: currentDemands.patterns,
  };
  return {
    note: "Change demand settings",
    putDemands: demands,
  };
};
