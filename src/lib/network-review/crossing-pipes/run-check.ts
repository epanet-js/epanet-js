import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { ArrayBufferType, hasWebWorker } from "src/infra/worker";
import {
  decodeCrossingPipes,
  EncodedCrossingPipes,
  encodeHydraulicModel,
  CrossingPipe,
  RunData,
} from "./data";
import { findCrossingPipes } from "./find-crossing-pipes";
import { CrossingPipesWorkerAPI } from "./worker";

export const runCheck = async (
  hydraulicModel: HydraulicModel,
  junctionTolerance: number = 0.0000045, // ~0.5 meters
  bufferType: ArrayBufferType = "array",
): Promise<CrossingPipe[]> => {
  const { idsLookup, ...inputData } = encodeHydraulicModel(
    hydraulicModel,
    bufferType,
  );

  const useWorker = hasWebWorker();

  const encodedCrossingPipes = useWorker
    ? await runWithWorker(inputData, junctionTolerance)
    : findCrossingPipes(inputData, junctionTolerance);

  return decodeCrossingPipes(hydraulicModel, idsLookup, encodedCrossingPipes);
};

const runWithWorker = async (
  data: RunData,
  junctionTolerance: number,
): Promise<EncodedCrossingPipes> => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<CrossingPipesWorkerAPI>(worker);

  try {
    return await workerAPI.findCrossingPipes(data, junctionTolerance);
  } finally {
    worker.terminate();
  }
};
