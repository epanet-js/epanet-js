import * as Comlink from "comlink";
import { RunData, EncodedSubNetworks } from "./data";
import { findSubNetworksFromBuffers } from "./find-subnetworks";

export interface ConnectivityTraceWorkerAPI {
  findSubNetworksFromBuffers: (input: RunData) => EncodedSubNetworks;
}

const workerAPI: ConnectivityTraceWorkerAPI = {
  findSubNetworksFromBuffers,
};

Comlink.expose(workerAPI);
