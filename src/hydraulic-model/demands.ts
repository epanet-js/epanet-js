import { AssetId } from "./asset-types";
import { CustomerPointId } from "./customer-points";
import { CustomerPointsLookup } from "./customer-points-lookup";

export type PatternMultipliers = number[];

export type PatternId = number;

export type DemandPattern = {
  id: PatternId;
  label: string;
  multipliers: number[];
};

export type DemandPatterns = Map<PatternId, DemandPattern>;

export type Demand = {
  baseDemand: number;
  patternId?: PatternId;
};

export type AssignedDemands = {
  junctions: Map<AssetId, Demand[]>;
  customerPoints: Map<CustomerPointId, Demand[]>;
};

export type Demands = {
  multiplier: number;
  patterns: DemandPatterns;
  assignments: AssignedDemands;
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

export const getJunctionDemands = (
  assignments: AssignedDemands,
  junctionId: AssetId,
): Demand[] => assignments.junctions.get(junctionId) || [];

export const getCustomerPointDemands = (
  assignments: AssignedDemands,
  customerPointId: CustomerPointId,
): Demand[] => assignments.customerPoints.get(customerPointId) || [];

export const calculateAverageDemand = (
  demands: Demand[],
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

export const getTotalCustomerDemand = (
  junctionId: AssetId,
  customerPointsLookup: CustomerPointsLookup,
  patterns: DemandPatterns,
): number => {
  const connectedCustomerPoints =
    customerPointsLookup.getCustomerPoints(junctionId);
  return Array.from(connectedCustomerPoints).reduce(
    (sum, cp) => sum + calculateAverageDemand(cp.demands, patterns),
    0,
  );
};
