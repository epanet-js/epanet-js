export type PatternId = string;
export type DemandPattern = number[];
export type DemandPatterns = Map<PatternId, DemandPattern>;

export type JunctionDemand = {
  baseDemand: number;
  patternId?: string;
  category?: string;
};

export type Demands = {
  multiplier: number;
  patterns: DemandPatterns;
};

export const nullDemands: Demands = {
  multiplier: 1,
  patterns: new Map(),
};
