import * as Comlink from "comlink";
import { RunData, EncodedOrphanAssets } from "./data";
import { findOrphanAssets } from "./find-orphan-assets";

export interface OrphanAssetsWorkerAPI {
  findOrphanAssets: (input: RunData) => EncodedOrphanAssets;
}

const workerAPI: OrphanAssetsWorkerAPI = {
  findOrphanAssets,
};

Comlink.expose(workerAPI);
