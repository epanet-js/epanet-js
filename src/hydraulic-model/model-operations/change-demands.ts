import { Demands } from "../demands";
import { ModelOperation } from "../model-operation";

type InputData = {
  demandMultiplier: number;
};

export const changeDemands: ModelOperation<InputData> = (
  _,
  { demandMultiplier },
) => {
  const demands: Demands = { multiplier: demandMultiplier };
  return {
    note: "Change demands",
    putDemands: demands,
  };
};
