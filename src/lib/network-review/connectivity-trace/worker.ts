import * as Comlink from "comlink";
import { RunData, EncodedSubNetworks } from "./data";
import { findSubNetworks } from "./find-subnetworks";

export interface ConnectivityTraceWorkerAPI {
  findSubNetworks: (input: RunData) => EncodedSubNetworks;
}

const workerAPI: ConnectivityTraceWorkerAPI = {
  findSubNetworks,
};

Comlink.expose(workerAPI);
