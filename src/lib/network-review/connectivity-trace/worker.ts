import * as Comlink from "comlink";
import { EncodedSubNetwork } from "./data";
import { findSubNetworks } from "./find-subnetworks";
import { HydraulicModelBuffers } from "../hydraulic-model-buffers";

export interface ConnectivityTraceWorkerAPI {
  findSubNetworks: (buffers: HydraulicModelBuffers) => EncodedSubNetwork[];
}

const workerAPI: ConnectivityTraceWorkerAPI = {
  findSubNetworks,
};

Comlink.expose(workerAPI);
