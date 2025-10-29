import * as Comlink from "comlink";
import { EncodedCrossingPipes } from "./data";
import { findCrossingPipes } from "./find-crossing-pipes";
import { HydraulicModelBuffers } from "../hydraulic-model-buffers";

export interface CrossingPipesWorkerAPI {
  findCrossingPipes: (
    buffers: HydraulicModelBuffers,
    junctionTolerance: number,
  ) => EncodedCrossingPipes;
}

const workerAPI: CrossingPipesWorkerAPI = {
  findCrossingPipes,
};

Comlink.expose(workerAPI);
