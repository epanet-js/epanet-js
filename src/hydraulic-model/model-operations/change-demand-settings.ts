import { Demands, DemandPatterns } from "../demands";
import { ModelOperation } from "../model-operation";

type InputData = {
  demandMultiplier?: number;
  patterns?: DemandPatterns;
};

export const changeDemandSettings: ModelOperation<InputData> = (
  { demands: currentDemands },
  { demandMultiplier, patterns },
) => {
  const demands: Demands = {
    multiplier: demandMultiplier ?? currentDemands.multiplier,
    patterns: patterns ?? currentDemands.patterns,
  };

  const note =
    demandMultiplier !== undefined && patterns !== undefined
      ? "Change demand settings"
      : patterns !== undefined
        ? "Change demand patterns"
        : "Change demand multiplier";

  return {
    note,
    putDemands: demands,
  };
};
