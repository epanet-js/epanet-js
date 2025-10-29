import * as Comlink from "comlink";
import { EncodedOrphanAssets } from "./data";
import { findOrphanAssets } from "./find-orphan-assets";
import { HydraulicModelBuffers } from "../hydraulic-model-buffers";

export interface OrphanAssetsWorkerAPI {
  findOrphanAssets: (buffers: HydraulicModelBuffers) => EncodedOrphanAssets;
}

const workerAPI: OrphanAssetsWorkerAPI = {
  findOrphanAssets,
};

Comlink.expose(workerAPI);
