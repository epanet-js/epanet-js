import { OrphanAssets, RunData } from "./data";
import { findOrphanAssets } from "./find-orphan-assets";
import { AssetIndexView } from "src/hydraulic-model/asset-index";
import { TopologyView } from "src/hydraulic-model/topology/topologyView";

export interface OrphanAssetsWorkerAPI {
  findOrphanAssets: (data: RunData) => OrphanAssets;
}

function run(data: RunData) {
  const assetIndex = new AssetIndexView(data.assetIndexBuffers);
  const topology = new TopologyView(data.topologyBuffers, assetIndex);

  return findOrphanAssets(topology, assetIndex);
}

export const workerAPI: OrphanAssetsWorkerAPI = {
  findOrphanAssets: run,
};
