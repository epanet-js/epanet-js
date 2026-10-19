import * as Comlink from "comlink";
import {
  EncodedSubNetwork,
  HydraulicModelBuffers,
  findSubNetworks,
} from "@epanet-js/hydraulic-model";

export interface ConnectivityTraceWorkerAPI {
  findSubNetworks: (buffers: HydraulicModelBuffers) => EncodedSubNetwork[];
}

const workerAPI: ConnectivityTraceWorkerAPI = {
  findSubNetworks,
};

Comlink.expose(workerAPI);
