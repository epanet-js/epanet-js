import * as Comlink from "comlink";
import { RunData, EncodedProximityAnomalies } from "./data";
import { findProximityAnomalies } from "./find-proximity-anomalies";

export interface ProximityCheckWorkerAPI {
  findProximityAnomalies: (
    input: RunData,
    distance: number,
  ) => EncodedProximityAnomalies;
}

const workerAPI: ProximityCheckWorkerAPI = {
  findProximityAnomalies,
};

Comlink.expose(workerAPI);
