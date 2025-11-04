import { OrphanAssets, RunData } from "./data";
import { findOrphanAssets } from "./find-orphan-assets";
import { AssetTypesView } from "src/hydraulic-model/asset-type-queries";
import { AssetIndexView } from "src/hydraulic-model/asset-index";
import { TopologyView } from "src/hydraulic-model/topology/topologyView";

export interface OrphanAssetsWorkerAPI {
  findOrphanAssets: (data: RunData) => OrphanAssets;
}

function run(data: RunData) {
  const assetIndex = new AssetIndexView(data.assetIndexBuffer);
  const topology = new TopologyView(data.topologyBuffers, assetIndex);
  const assetTypes = new AssetTypesView(data.assetTypeBuffers, assetIndex);

  return findOrphanAssets(topology, assetIndex, assetTypes);
}

export const workerAPI: OrphanAssetsWorkerAPI = {
  findOrphanAssets: run,
};
