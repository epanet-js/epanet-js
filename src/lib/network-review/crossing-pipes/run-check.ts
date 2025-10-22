import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { ArrayBufferType, canUseWorker } from "src/infra/worker";
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
  signal?: AbortSignal,
): Promise<CrossingPipe[]> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const { idsLookup, ...inputData } = encodeHydraulicModel(
    hydraulicModel,
    bufferType,
  );

  const useWorker = canUseWorker();

  const encodedCrossingPipes = useWorker
    ? await runWithWorker(inputData, junctionTolerance, signal)
    : findCrossingPipes(inputData, junctionTolerance);

  return decodeCrossingPipes(hydraulicModel, idsLookup, encodedCrossingPipes);
};

const runWithWorker = async (
  data: RunData,
  junctionTolerance: number,
  signal?: AbortSignal,
): Promise<EncodedCrossingPipes> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<CrossingPipesWorkerAPI>(worker);

  const abortHandler = () => worker.terminate();
  signal?.addEventListener("abort", abortHandler);

  try {
    return await workerAPI.findCrossingPipes(data, junctionTolerance);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
