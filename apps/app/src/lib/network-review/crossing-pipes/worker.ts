import * as Comlink from "comlink";
import {
  EncodedCrossingPipes,
  HydraulicModelBuffers,
  findCrossingPipes,
} from "@epanet-js/network-review";

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
