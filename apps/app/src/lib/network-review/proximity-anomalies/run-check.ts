import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import {
  ArrayBufferType,
  canUseWorker,
  enrichWorkerError,
} from "src/infra/worker";
import {
  decodeProximityAnomalies,
  EncodedProximityAnomalies,
  ProximityAnomaly,
} from "./data";
import {
  HydraulicModelBuffers,
  HydraulicModelEncoder,
  hydraulicModelTransferables,
} from "../hydraulic-model-buffers";
import { findProximityAnomalies } from "./find-proximity-anomalies";
import {
  createProximityAnomaliesWorker,
  getProximityAnomaliesWorker,
} from "./get-worker";
import { isFullOfflineSupportEnabled } from "src/infra/long-lived-workers";

export const runCheck = async (
  hydraulicModel: HydraulicModel,
  distanceInMeters: number = 0.5,
  bufferType: ArrayBufferType = "array",
  signal?: AbortSignal,
): Promise<ProximityAnomaly[]> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const encoder = new HydraulicModelEncoder(hydraulicModel, {
    nodes: new Set(["bounds", "connections"]),
    links: new Set(["connections", "geoIndex"]),
    bufferType,
  });
  const { linkIdsLookup, nodeIdsLookup, ...data } = encoder.buildBuffers();

  const useWorker = canUseWorker();

  const encodedProximityAnomalies = useWorker
    ? await runWithWorker(data, distanceInMeters, signal)
    : findProximityAnomalies(data, distanceInMeters);

  return decodeProximityAnomalies(
    hydraulicModel,
    nodeIdsLookup,
    linkIdsLookup,
    encodedProximityAnomalies,
  );
};

const runWithWorker = async (
  data: HydraulicModelBuffers,
  distance: number,
  signal?: AbortSignal,
): Promise<EncodedProximityAnomalies> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const transferData = Comlink.transfer(
    data,
    hydraulicModelTransferables(data),
  );

  if (isFullOfflineSupportEnabled()) {
    const workerAPI = getProximityAnomaliesWorker();
    try {
      const result = await workerAPI.findProximityAnomalies(
        transferData,
        distance,
      );
      if (signal?.aborted) {
        throw new DOMException("Operation cancelled", "AbortError");
      }
      return result;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw enrichWorkerError("proximity-anomalies", e);
    }
  }

  const { worker, api: workerAPI } = createProximityAnomaliesWorker();

  const abortHandler = () => worker.terminate();
  signal?.addEventListener("abort", abortHandler);

  try {
    return await workerAPI.findProximityAnomalies(transferData, distance);
  } catch (e) {
    throw enrichWorkerError("proximity-anomalies", e);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
