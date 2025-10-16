import * as Comlink from "comlink";
import { RunData, EncodedCrossingPipes } from "./data";
import { findCrossingPipes } from "./find-crossing-pipes";

export interface CrossingPipesWorkerAPI {
  findCrossingPipes: (
    input: RunData,
    junctionTolerance: number,
  ) => EncodedCrossingPipes;
}

const workerAPI: CrossingPipesWorkerAPI = {
  findCrossingPipes,
};

Comlink.expose(workerAPI);
