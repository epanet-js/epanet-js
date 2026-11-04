import { Node } from "./asset-types/node";
import { Pump } from "./asset-types/pump";
import { Reservoir } from "./asset-types/reservoir";
import type { Demand } from "./demands";
import type { HydraulicModel } from "./hydraulic-model";
import type { PatternId } from "./patterns";

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
