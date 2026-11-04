import type { AssetId, HydraulicModel } from "src/hydraulic-model";
import type { ResultsReader } from "@epanet-js/simulation";
import { runZoneContentsQuery } from "src/lib/spatial-query/zone-contents";
import { captureError } from "src/infra/error-tracking";

export type ValueRange = { min: number; max: number };

export const activeJunctionIds = (
  hydraulicModel: HydraulicModel,
  assetIds: readonly AssetId[],
): AssetId[] =>
  assetIds.filter((id) => {
    const asset = hydraulicModel.assets.get(id);
    return asset?.type === "junction" && asset.isActive;
  });

export const queryZoneJunctionIds = async (
  hydraulicModel: HydraulicModel,
  zoneIds: readonly number[],
): Promise<AssetId[]> => {
  if (zoneIds.length === 0) return [];
  try {
    const { assetIds } = await runZoneContentsQuery(
      hydraulicModel,
      [...zoneIds],
      false,
    );
    return activeJunctionIds(hydraulicModel, assetIds);
  } catch (error) {
    captureError(error as Error);
    throw error;
  }
};

export const elevationRange = (
  hydraulicModel: HydraulicModel,
  junctionIds: readonly AssetId[],
): ValueRange | null => {
  let min = Infinity;
  let max = -Infinity;
  for (const id of junctionIds) {
    const junction = hydraulicModel.assets.get(id);
    if (junction?.type !== "junction") continue;
    const { elevation } = junction;
    if (elevation == null) continue;
    if (elevation < min) min = elevation;
    if (elevation > max) max = elevation;
  }
  return Number.isFinite(min) ? { min, max } : null;
};

export const pressureRange = (
  results: Pick<ResultsReader, "getJunction"> | null,
  junctionIds: readonly AssetId[],
): ValueRange | null => {
  if (!results) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const id of junctionIds) {
    const junction = results.getJunction(id);
    if (!junction) continue;
    if (junction.minPressure < min) min = junction.minPressure;
    if (junction.maxPressure > max) max = junction.maxPressure;
  }
  return Number.isFinite(min) ? { min, max } : null;
};
