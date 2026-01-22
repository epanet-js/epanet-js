export type PatternLabel = string;
export type PatternMultipliers = number[];
export type DemandPatternsLegacy = Map<PatternLabel, PatternMultipliers>;

export type JunctionDemand = {
  baseDemand: number;
  patternLabel?: string;
};

export type Demands = {
  multiplier: number;
  patternsLegacy: DemandPatternsLegacy;
};

export const createEmptyDemands = (): Demands => ({
  multiplier: 1,
  patternsLegacy: new Map(),
});

export const calculateAverageDemandLegacy = (
  demands: JunctionDemand[],
  patterns: DemandPatternsLegacy,
): number => {
  return demands.reduce((total, demand) => {
    if (!demand.patternLabel) {
      return total + demand.baseDemand;
    }

    const pattern = patterns.get(demand.patternLabel);
    if (!pattern || pattern.length === 0) {
      return total + demand.baseDemand;
    }

    const avgMultiplier =
      pattern.reduce((sum, m) => sum + m, 0) / pattern.length;
    return total + demand.baseDemand * avgMultiplier;
  }, 0);
};
