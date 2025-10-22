import * as Comlink from "comlink";
import { HydraulicModel } from "src/hydraulic-model";
import { Subnetwork } from "./data";
import { findSubNetworks } from "./find-subnetworks";

export interface ConnectivityTraceWorkerAPI {
  findSubNetworks: (hydraulicModel: HydraulicModel) => Subnetwork[];
}

const workerAPI: ConnectivityTraceWorkerAPI = {
  findSubNetworks,
};

Comlink.expose(workerAPI);
