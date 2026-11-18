import * as Comlink from "comlink";

import { BufferType } from "@epanet-js/buffers";
import {
  ActiveAssetIndex,
  ActiveTopology,
  configuredAllowedFlowDirections,
} from "@epanet-js/hydraulic-model";
import {
  configuredJunctionDemands,
  findTopologyIssues,
  type TopologyIssues,
} from "@epanet-js/network-review";
import { HydraulicModel } from "src/hydraulic-model";
import { canUseWorker, enrichWorkerError } from "src/infra/worker";
import { encodeData, runDataTransferables } from "./data";
import { getTopologyChecksWorker } from "./get-worker";

export const runCheck = async (
  hydraulicModel: HydraulicModel,
  signal: AbortSignal | undefined = undefined,
  bufferType: BufferType = "array",
  runInWorker: boolean = true,
): Promise<TopologyIssues> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  return runInWorker
    ? runWithWorker(hydraulicModel, bufferType, signal)
    : findTopologyIssues(
        new ActiveTopology(hydraulicModel.topology, hydraulicModel.assets),
        new ActiveAssetIndex(hydraulicModel.assetIndex, hydraulicModel.assets),
        configuredAllowedFlowDirections(hydraulicModel.assets),
        configuredJunctionDemands(hydraulicModel),
      );
};

const runWithWorker = async (
  model: HydraulicModel,
  bufferType: BufferType,
  signal?: AbortSignal,
): Promise<TopologyIssues> => {
  const data = encodeData(model, bufferType);

  if (!canUseWorker()) {
    const { workerAPI: fallbackWorkerAPI } = await import("./worker-api");
    return fallbackWorkerAPI.findTopologyIssues(data);
  }

  const workerAPI = getTopologyChecksWorker();
  try {
    const result = await workerAPI.findTopologyIssues(
      Comlink.transfer(data, runDataTransferables(data)),
    );
    if (signal?.aborted) {
      throw new DOMException("Operation cancelled", "AbortError");
    }
    return result;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw enrichWorkerError("topology-checks", e);
  }
};
