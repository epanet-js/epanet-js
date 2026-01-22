import { Demands, DemandPatternsLegacy, DemandPatterns } from "../demands";
import { ModelOperation } from "../model-operation";

type InputData = {
  demandMultiplier?: number;
  patternsLegacy?: DemandPatternsLegacy;
  patterns?: DemandPatterns;
};

export const changeDemandSettings: ModelOperation<InputData> = (
  { demands: currentDemands },
  { demandMultiplier, patternsLegacy, patterns },
) => {
  const demands: Demands = {
    multiplier: demandMultiplier ?? currentDemands.multiplier,
    patternsLegacy: patternsLegacy ?? currentDemands.patternsLegacy,
    patterns: patterns ?? currentDemands.patterns,
  };

  const note =
    demandMultiplier !== undefined &&
    (patternsLegacy !== undefined || patterns !== undefined)
      ? "Change demand settings"
      : patternsLegacy !== undefined || patterns !== undefined
        ? "Change demand patterns"
        : "Change demand multiplier";

  return {
    note,
    putDemands: demands,
  };
};
