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
