import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { ArrayBufferType, canUseWorkers } from "src/infra/worker";
import {
  decodePossibleConnections,
  EncodedPossibleConnections,
  encodeHydraulicModel,
  PossibleConnection,
  RunData,
} from "./data";
import { findPossibleConnections } from "./find-possible-connections";
import { ProximityCheckWorkerAPI } from "./worker";

export const runCheck = async (
  hydraulicModel: HydraulicModel,
  distanceInMeters: number = 0.5,
  bufferType: ArrayBufferType = "array",
): Promise<PossibleConnection[]> => {
  const { idsLookup, ...inputData } = encodeHydraulicModel(
    hydraulicModel,
    bufferType,
  );

  const useWorker = canUseWorkers(bufferType);

  const encodedPossibleConnections = useWorker
    ? await runWithWorker(inputData, distanceInMeters)
    : findPossibleConnections(inputData, distanceInMeters);

  return decodePossibleConnections(
    hydraulicModel,
    idsLookup,
    encodedPossibleConnections,
  );
};

const runWithWorker = async (
  data: RunData,
  distance: number,
): Promise<EncodedPossibleConnections> => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<ProximityCheckWorkerAPI>(worker);

  try {
    return await workerAPI.findPossibleConnections(data, distance);
  } finally {
    worker.terminate();
  }
};
