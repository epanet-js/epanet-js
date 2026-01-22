import { Demands, DemandPatternsLegacy } from "../demands";
import { ModelOperation } from "../model-operation";

type InputData = {
  demandMultiplier?: number;
  patternsLegacy?: DemandPatternsLegacy;
};

export const changeDemandSettings: ModelOperation<InputData> = (
  { demands: currentDemands },
  { demandMultiplier, patternsLegacy },
) => {
  const demands: Demands = {
    multiplier: demandMultiplier ?? currentDemands.multiplier,
    patternsLegacy: patternsLegacy ?? currentDemands.patternsLegacy,
    patterns: currentDemands.patterns,
  };

  const note =
    demandMultiplier !== undefined && patternsLegacy !== undefined
      ? "Change demand settings"
      : patternsLegacy !== undefined
        ? "Change demand patterns"
        : "Change demand multiplier";

  return {
    note,
    putDemands: demands,
  };
};
