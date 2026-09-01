import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import {
  ArrayBufferType,
  canUseWorker,
  enrichWorkerError,
} from "src/infra/worker";
import {
  decodeCrossingPipes,
  EncodedCrossingPipes,
  CrossingPipe,
} from "./data";
import {
  HydraulicModelBuffers,
  HydraulicModelEncoder,
  hydraulicModelTransferables,
} from "../hydraulic-model-buffers";
import { findCrossingPipes } from "./find-crossing-pipes";
import {
  createCrossingPipesWorker,
  getCrossingPipesWorker,
} from "./get-worker";
import { isFullOfflineSupportEnabled } from "src/infra/long-lived-workers";

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

  const transferData = Comlink.transfer(
    data,
    hydraulicModelTransferables(data),
  );

  if (isFullOfflineSupportEnabled()) {
    const workerAPI = getCrossingPipesWorker();
    try {
      const result = await workerAPI.findCrossingPipes(
        transferData,
        junctionTolerance,
      );
      if (signal?.aborted) {
        throw new DOMException("Operation cancelled", "AbortError");
      }
      return result;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw enrichWorkerError("crossing-pipes", e);
    }
  }

  const { worker, api: workerAPI } = createCrossingPipesWorker();

  const abortHandler = () => worker.terminate();
  signal?.addEventListener("abort", abortHandler);

  try {
    return await workerAPI.findCrossingPipes(transferData, junctionTolerance);
  } catch (e) {
    throw enrichWorkerError("crossing-pipes", e);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
