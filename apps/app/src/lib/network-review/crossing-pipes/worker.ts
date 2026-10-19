import * as Comlink from "comlink";
import {
  EncodedCrossingPipes,
  HydraulicModelBuffers,
  findCrossingPipes,
} from "@epanet-js/hydraulic-model";

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
