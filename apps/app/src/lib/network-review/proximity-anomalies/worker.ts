import * as Comlink from "comlink";
import { EncodedProximityAnomalies } from "./data";
import { findProximityAnomalies } from "./find-proximity-anomalies";
import { HydraulicModelBuffers } from "@epanet-js/hydraulic-model";

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
