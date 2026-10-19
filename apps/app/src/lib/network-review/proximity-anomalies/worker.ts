import * as Comlink from "comlink";
import {
  EncodedProximityAnomalies,
  HydraulicModelBuffers,
  findProximityAnomalies,
} from "@epanet-js/hydraulic-model";

export interface ProximityCheckWorkerAPI {
  findProximityAnomalies: (
    buffers: HydraulicModelBuffers,
    distance: number,
  ) => EncodedProximityAnomalies;
}

const workerAPI: ProximityCheckWorkerAPI = {
  findProximityAnomalies,
};

Comlink.expose(workerAPI);
