import { Demands } from "../demands";
import { ModelOperation } from "../model-operation";

type InputData = {
  demandMultiplier: number;
};

export const changeDemands: ModelOperation<InputData> = (
  _hydraulicModel,
  { demandMultiplier },
) => {
  const demands: Demands = {
    multiplier: demandMultiplier,
    patterns: new Map(),
  };
  return {
    note: "Change demands",
    putDemands: demands,
  };
};
