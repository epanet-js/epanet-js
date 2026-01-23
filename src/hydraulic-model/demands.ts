export type PatternLabel = string;
export type PatternMultipliers = number[];
export type DemandPatternsLegacy = Map<PatternLabel, PatternMultipliers>;

export type PatternId = number;

export type DemandPattern = {
  id: PatternId;
  label: string;
  multipliers: number[];
};

export type DemandPatterns = Map<PatternId, DemandPattern>;

export type JunctionDemand = {
  baseDemand: number;
  patternId?: PatternId;
};

export type Demands = {
  multiplier: number;
  patternsLegacy: DemandPatternsLegacy;
  patterns: DemandPatterns;
};

export const createEmptyDemands = (): Demands => ({
  multiplier: 1,
  patternsLegacy: new Map(),
  patterns: new Map(),
});

export const getNextPatternId = (
  patterns: DemandPatterns,
  startId?: number,
): PatternId => {
  let nextId = startId ?? Math.max(patterns.size - 1, 1);
  while (patterns.has(nextId)) {
    nextId += 1;
  }
  return nextId;
};

export const calculateAverageDemand = (
  demands: JunctionDemand[],
  patterns: DemandPatterns,
): number => {
  return demands.reduce((total, demand) => {
    if (demand.patternId) {
      const pattern = patterns.get(demand.patternId);

      if (pattern && pattern.multipliers.length >= 0) {
        const avgMultiplier =
          pattern.multipliers.reduce((sum, m) => sum + m, 0) /
          pattern.multipliers.length;
        return total + demand.baseDemand * avgMultiplier;
      }
    }

    return total + demand.baseDemand;
  }, 0);
};
