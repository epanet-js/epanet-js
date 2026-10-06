import {
  Node,
  Pump,
  Reservoir,
  Tank,
  Valve,
  type CurveId,
  type Demand,
  type PatternId,
} from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "../hydraulic-model";

export const isCurveInUse = (
  hydraulicModel: HydraulicModel,
  curveId: CurveId,
): boolean => {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset instanceof Pump) {
      if (asset.curveId === curveId || asset.efficiencyCurveId === curveId)
        return true;
    } else if (asset instanceof Tank) {
      if (asset.volumeCurveId === curveId) return true;
    } else if (asset instanceof Valve) {
      if (asset.curveId === curveId) return true;
    }
  }
  return false;
};

export const isPatternInUse = (
  hydraulicModel: HydraulicModel,
  patternId: PatternId,
  energyGlobalPatternId?: PatternId | null,
): boolean => {
  if (energyGlobalPatternId === patternId) return true;

  const { junctions, customerPoints } = hydraulicModel.demands;
  if (
    anyDemandUses(junctions.values(), patternId) ||
    anyDemandUses(customerPoints.values(), patternId)
  )
    return true;

  for (const asset of hydraulicModel.assets.values()) {
    if (asset instanceof Node) {
      if (asset.chemicalSourcePatternId === patternId) return true;
      if (asset instanceof Reservoir && asset.headPatternId === patternId)
        return true;
    } else if (asset instanceof Pump) {
      if (
        asset.speedPatternId === patternId ||
        asset.energyPricePatternId === patternId
      )
        return true;
    }
  }
  return false;
};

const anyDemandUses = (
  demandLists: Iterable<Demand[]>,
  patternId: PatternId,
): boolean => {
  for (const demands of demandLists) {
    for (const demand of demands) {
      if (demand.patternId === patternId) return true;
    }
  }
  return false;
};
