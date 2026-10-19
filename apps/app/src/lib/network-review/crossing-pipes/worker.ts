import * as Comlink from "comlink";
import { EncodedCrossingPipes } from "./data";
import { findCrossingPipes } from "./find-crossing-pipes";
import { HydraulicModelBuffers } from "@epanet-js/hydraulic-model";

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
