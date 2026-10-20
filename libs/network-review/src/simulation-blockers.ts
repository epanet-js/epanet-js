import { AssetId, HydraulicModel } from "@epanet-js/hydraulic-model";

export const ORPHAN_ASSETS_RULE_ID = "asset.connected";
export const UNSUPPLIED_SUBNETWORK_RULE_ID = "subNetwork.supplySource.present";

// EPANET solves a model with a disconnected tank or reservoir, so the review
// still reports them but they must not gate a run.
export const blocksSimulation = (
  model: HydraulicModel,
  assetId: AssetId,
): boolean => {
  const type = model.assets.get(assetId)?.type;
  return type !== "tank" && type !== "reservoir";
};
