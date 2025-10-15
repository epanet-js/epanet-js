import * as Comlink from "comlink";
import { RunData, EncodedPossibleConnections } from "./data";
import { findPossibleConnections } from "./find-possible-connections";

export interface ProximityCheckWorkerAPI {
  findPossibleConnections: (
    input: RunData,
    distance: number,
  ) => EncodedPossibleConnections;
}

const workerAPI: ProximityCheckWorkerAPI = {
  findPossibleConnections,
};

Comlink.expose(workerAPI);
