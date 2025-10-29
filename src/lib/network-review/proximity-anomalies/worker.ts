import * as Comlink from "comlink";
import { EncodedProximityAnomalies } from "./data";
import { findProximityAnomalies } from "./find-proximity-anomalies";
import { HydraulicModelBuffers } from "../hydraulic-model-buffers";

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
