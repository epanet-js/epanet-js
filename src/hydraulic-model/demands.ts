export type PatternId = string;
export type DemandPattern = number[];
export type DemandPatterns = Map<PatternId, DemandPattern>;

export type JunctionDemand = {
  baseDemand: number;
  patternId?: string;
};

export type Demands = {
  multiplier: number;
  patterns: DemandPatterns;
};

export const createEmptyDemands = (): Demands => ({
  multiplier: 1,
  patterns: new Map(),
});

export const calculateAverageDemand = (
  demands: JunctionDemand[],
  patterns: DemandPatterns,
): number => {
  return demands.reduce((total, demand) => {
    if (!demand.patternId) {
      return total + demand.baseDemand;
    }

    const pattern = patterns.get(demand.patternId);
    if (!pattern || pattern.length === 0) {
      return total + demand.baseDemand;
    }

    const avgMultiplier =
      pattern.reduce((sum, m) => sum + m, 0) / pattern.length;
    return total + demand.baseDemand * avgMultiplier;
  }, 0);
};
