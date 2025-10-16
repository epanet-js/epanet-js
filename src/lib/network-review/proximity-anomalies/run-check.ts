import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { ArrayBufferType, canUseWorkers } from "src/infra/worker";
import {
  decodeProximityAnomalies,
  EncodedProximityAnomalies,
  encodeHydraulicModel,
  ProximityAnomaly,
  RunData,
} from "./data";
import { findProximityAnomalies } from "./find-proximity-anomalies";
import { ProximityCheckWorkerAPI } from "./worker";

export const runCheck = async (
  hydraulicModel: HydraulicModel,
  distanceInMeters: number = 0.5,
  bufferType: ArrayBufferType = "array",
): Promise<ProximityAnomaly[]> => {
  const { idsLookup, ...inputData } = encodeHydraulicModel(
    hydraulicModel,
    bufferType,
  );

  const useWorker = canUseWorkers(bufferType);

  const encodedProximityAnomalies = useWorker
    ? await runWithWorker(inputData, distanceInMeters)
    : findProximityAnomalies(inputData, distanceInMeters);

  return decodeProximityAnomalies(
    hydraulicModel,
    idsLookup,
    encodedProximityAnomalies,
  );
};

const runWithWorker = async (
  data: RunData,
  distance: number,
): Promise<EncodedProximityAnomalies> => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<ProximityCheckWorkerAPI>(worker);

  try {
    return await workerAPI.findProximityAnomalies(data, distance);
  } finally {
    worker.terminate();
  }
};
