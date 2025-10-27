import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { ArrayBufferType, canUseWorker } from "src/infra/worker";
import {
  decodeProximityAnomalies,
  EncodedProximityAnomalies,
  ProximityAnomaly,
} from "./data";
import { HydraulicModelBuffers, HydraulicModelEncoder } from "../shared";
import { findProximityAnomalies } from "./find-proximity-anomalies";
import { ProximityCheckWorkerAPI } from "./worker";

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

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<ProximityCheckWorkerAPI>(worker);

  const abortHandler = () => worker.terminate();
  signal?.addEventListener("abort", abortHandler);

  try {
    return await workerAPI.findProximityAnomalies(data, distance);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
