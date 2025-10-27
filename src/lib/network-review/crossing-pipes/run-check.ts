import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { ArrayBufferType, canUseWorker } from "src/infra/worker";
import {
  decodeCrossingPipes,
  EncodedCrossingPipes,
  CrossingPipe,
} from "./data";
import { HydraulicModelBuffers, HydraulicModelEncoder } from "../shared";
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

  const encoder = new HydraulicModelEncoder(hydraulicModel, {
    nodes: new Set(["geoIndex"]),
    links: new Set(["connections", "bounds", "geoIndex"]),
    bufferType,
  });
  const { linkIdsLookup, nodeIdsLookup, ...data } = encoder.buildBuffers();

  const useWorker = canUseWorker();

  const encodedCrossingPipes = useWorker
    ? await runWithWorker(data, junctionTolerance, signal)
    : findCrossingPipes(data, junctionTolerance);

  return decodeCrossingPipes(
    hydraulicModel,
    linkIdsLookup,
    encodedCrossingPipes,
  );
};

const runWithWorker = async (
  data: HydraulicModelBuffers,
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
