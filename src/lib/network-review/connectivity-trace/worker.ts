import * as Comlink from "comlink";
import { HydraulicModel } from "src/hydraulic-model";
import { SubNetwork } from "./data";
import { findSubNetworks } from "./find-subnetworks";

export interface ConnectivityTraceWorkerAPI {
  findSubNetworks: (hydraulicModel: HydraulicModel) => SubNetwork[];
}

const workerAPI: ConnectivityTraceWorkerAPI = {
  findSubNetworks,
};

Comlink.expose(workerAPI);
