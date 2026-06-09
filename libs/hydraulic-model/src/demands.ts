import { AssetId } from "./asset-types";
import { CustomerPointId } from "./customer-points";
import { CustomerPointsLookup } from "./customer-points-lookup";
import { PatternId, Patterns } from "./patterns";

export type Demand = {
  baseDemand: number;
  patternId?: PatternId;
};

export type JunctionAssignedDemands = Map<AssetId, Demand[]>;
export type CustomerAssignedDemands = Map<CustomerPointId, Demand[]>;

export type Demands = {
  junctions: JunctionAssignedDemands;
  customerPoints: CustomerAssignedDemands;
};

export const createEmptyDemands = (): Demands => ({
  junctions: new Map(),
  customerPoints: new Map(),
});

export const getJunctionDemands = (
  demands: Demands,
  junctionId: AssetId,
): Demand[] => demands.junctions.get(junctionId) || [];

export const getCustomerPointDemands = (
  demands: Demands,
  customerPointId: CustomerPointId,
): Demand[] => demands.customerPoints.get(customerPointId) || [];

export type PatternAverageCache = Map<PatternId, number>;

export const averagePatternMultiplier = (
  patternId: PatternId,
  patterns: Patterns,
  cache?: PatternAverageCache,
): number => {
  const cached = cache?.get(patternId);
  if (cached !== undefined) return cached;
  const pattern = patterns.get(patternId);
  const avg =
    !pattern || pattern.multipliers.length === 0
      ? 1
      : pattern.multipliers.reduce((sum, m) => sum + m, 0) /
        pattern.multipliers.length;
  cache?.set(patternId, avg);
  return avg;
};

export const calculateAverageDemand = (
  demands: Demand[],
  patterns: Patterns,
  cache?: PatternAverageCache,
): number => {
  return demands.reduce((total, demand) => {
    const multiplier = demand.patternId
      ? averagePatternMultiplier(demand.patternId, patterns, cache)
      : 1;
    return total + demand.baseDemand * multiplier;
  }, 0);
};

export const getTotalCustomerDemand = (
  junctionId: AssetId,
  customerPointsLookup: CustomerPointsLookup,
  demands: Demands,
  patterns: Patterns,
): number => {
  const connectedCustomerPoints =
    customerPointsLookup.getCustomerPoints(junctionId);
  return Array.from(connectedCustomerPoints).reduce(
    (sum, cp) =>
      sum +
      calculateAverageDemand(getCustomerPointDemands(demands, cp.id), patterns),
    0,
  );
};
