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
  const syncedPatternsLegacy = patterns
    ? new Map(
        Array.from(patterns.values()).map((p) => [p.label, p.multipliers]),
      )
    : undefined;

  const demands: Demands = {
    multiplier: demandMultiplier ?? currentDemands.multiplier,
    patternsLegacy: syncedPatternsLegacy ?? currentDemands.patternsLegacy,
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
