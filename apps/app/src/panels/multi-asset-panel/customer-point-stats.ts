import {
  UnitsSpec,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import { getDecimals } from "src/lib/project-settings";
import type { CustomerPoint } from "@epanet-js/hydraulic-model";
import type {
  Demands,
  Patterns,
  PatternAverageCache,
} from "src/hydraulic-model";
import {
  calculateAverageDemand,
  getCustomerPointDemands,
} from "src/hydraulic-model";
import { convertTo } from "@epanet-js/quantity";
import {
  type PropertyStats,
  updateBooleanStats,
  updateLinkStats,
  updateQuantityStats,
} from "./stats";

export type CustomerPointPropertySections = {
  connections: PropertyStats[];
  demands: PropertyStats[];
};

export const computeCustomerPointsStats = (
  customerPoints: CustomerPoint[],
  demands: Demands,
  patterns: Patterns,
  units: UnitsSpec,
  formatting: FormattingSpec,
): CustomerPointPropertySections => {
  const connectionsStats = new Map<string, PropertyStats>();
  const demandsStats = new Map<string, PropertyStats>();
  const patternAvgCache: PatternAverageCache = new Map();
  const flowUnit = units.customerDemand;
  const perDayUnit = units.customerDemandPerDay;
  const customerDemandOverrides = {
    unit: perDayUnit,
    decimals: getDecimals(formatting, "customerDemandPerDay") ?? 3,
  };
  const demandsCountOverrides = { isInteger: true, decimals: 0 };

  for (const cp of customerPoints) {
    const cpDemands = getCustomerPointDemands(demands, cp.id);

    updateBooleanStats(connectionsStats, "connected", !!cp.connection, cp.id);

    updateQuantityStats(
      demandsStats,
      "demandsCount",
      cpDemands.length,
      units,
      formatting,
      cp.id,
      demandsCountOverrides,
    );

    const uniquePatternLabels = new Set<string | undefined>();
    for (const demand of cpDemands) {
      const pattern = demand.patternId
        ? patterns.get(demand.patternId)
        : undefined;
      uniquePatternLabels.add(pattern?.label);
    }
    for (const label of uniquePatternLabels) {
      updateLinkStats(
        demandsStats,
        "customerPattern",
        label,
        cp.id,
        "constant",
      );
    }

    const averageDemand = calculateAverageDemand(
      cpDemands,
      patterns,
      patternAvgCache,
    );
    const averageDemandPerDay = convertTo(
      { value: averageDemand, unit: flowUnit },
      perDayUnit,
    );
    updateQuantityStats(
      demandsStats,
      "customerDemand",
      averageDemandPerDay,
      units,
      formatting,
      cp.id,
      customerDemandOverrides,
    );
  }

  return {
    connections: Array.from(connectionsStats.values()),
    demands: Array.from(demandsStats.values()),
  };
};
