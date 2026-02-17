import { AssetId } from "./asset-types";
import { CustomerPointId } from "./customer-points";

export type PatternMultipliers = number[];

export type PatternId = number;

export type DemandPattern = {
  id: PatternId;
  label: string;
  multipliers: number[];
};

export type DemandPatterns = Map<PatternId, DemandPattern>;

export type DemandAssignment = {
  baseDemand: number;
  patternId?: PatternId;
};

export type Demands = {
  multiplier: number;
  patterns: DemandPatterns;
  assignments: {
    junctions: Map<AssetId, DemandAssignment[]>;
    customerPoints: Map<CustomerPointId, DemandAssignment[]>;
  };
};

export const createEmptyDemands = (): Demands => ({
  multiplier: 1,
  patterns: new Map(),
  assignments: {
    junctions: new Map(),
    customerPoints: new Map(),
  },
});

export const getNextPatternId = (
  patterns: DemandPatterns,
  startId?: number,
): PatternId => {
  let nextId = Math.max(startId ?? patterns.size, 1);
  while (patterns.has(nextId)) {
    nextId += 1;
  }
  return nextId;
};

export const calculateAverageDemand = (
  demands: DemandAssignment[],
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
