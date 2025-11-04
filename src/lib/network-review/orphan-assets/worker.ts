import * as Comlink from "comlink";
import { OrphanAssets, RunData } from "./data";
import { findOrphanAssets } from "./find-orphan-assets";
import { TopologyView } from "src/hydraulic-model/topology/topologyView";
import { AssetIndexView } from "src/hydraulic-model/asset-index";
import { AssetTypesView } from "src/hydraulic-model/asset-type-queries";

export interface OrphanAssetsWorkerAPI {
  findOrphanAssets: (data: RunData) => OrphanAssets;
}

function run(data: RunData): OrphanAssets {
  const assetIndex = new AssetIndexView(data.assetIndexBuffer);
  const topology = new TopologyView(data.topologyBuffers, assetIndex);
  const assetTypes = new AssetTypesView(data.assetTypeBuffers, assetIndex);

  return findOrphanAssets(topology, assetIndex, assetTypes);
}

const workerAPI: OrphanAssetsWorkerAPI = {
  findOrphanAssets: run,
};

Comlink.expose(workerAPI);
