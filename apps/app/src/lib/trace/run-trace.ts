import * as Comlink from "comlink";

import {
  activeTopologyBarriers,
  anyBarrier,
  anyStartIsActive,
  AssetId,
  boundaryBarriers,
  configuredActiveTopology,
  configuredAllowedFlowDirections,
  trace,
  type TraceResult,
  type TraceStart,
} from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { ResultsReader } from "@epanet-js/simulation";
import { canUseWorker, enrichWorkerError } from "src/infra/worker";
import { encodeTraceData } from "./encode-trace-buffers";
import {
  flowDirectionTransferables,
  allowedFlowDirectionTransferables,
  activeTopologyTransferables,
} from "./trace-buffers";
import { topologyTransferables } from "src/hydraulic-model/topology/topology-transferable";
import { assetIndexTransferables } from "src/hydraulic-model/asset-index-transferable";
import { FlowDirection } from "./flow-direction";
import { TraceMode } from "./types";
import { upstreamTrace, downstreamTrace } from "./flow-trace";
import { getTraceWorker } from "./get-worker";

export interface TraceInput {
  mode: TraceMode;
  startNodeIds: AssetId[];
  startLinkIds: AssetId[];
}

export const runTrace = async (
  hydraulicModel: HydraulicModel,
  resultsReader: ResultsReader | null,
  input: TraceInput,
  signal?: AbortSignal,
): Promise<AssetId[]> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const result = canUseWorker()
    ? await runWithWorker(hydraulicModel, resultsReader, input, signal)
    : runSync(hydraulicModel, resultsReader, input);

  return [...result.nodeIds, ...result.linkIds];
};

function runSync(
  model: HydraulicModel,
  resultsReader: ResultsReader | null,
  input: TraceInput,
): TraceResult {
  const status = new FlowDirection(model.assets, resultsReader);
  const allowedFlowDirection = configuredAllowedFlowDirections(model.assets);
  const start: TraceStart = {
    nodeIds: input.startNodeIds,
    linkIds: input.startLinkIds,
  };

  switch (input.mode) {
    case "boundary":
      return trace(
        start,
        model.topology,
        anyBarrier(
          boundaryBarriers(
            model.topology,
            model.assetIndex,
            allowedFlowDirection,
          ),
          activeTopologyBarriers(
            configuredActiveTopology(model.assets),
            anyStartIsActive(model.assets, start),
          ),
        ),
      );
    case "upstream":
      return upstreamTrace(start, model.topology, status);
    case "downstream":
      return downstreamTrace(start, model.topology, status);
  }
}

const runWithWorker = async (
  model: HydraulicModel,
  resultsReader: ResultsReader | null,
  input: TraceInput,
  signal?: AbortSignal,
): Promise<TraceResult> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const data = encodeTraceData(model, resultsReader, input.mode);
  const start: TraceStart = {
    nodeIds: input.startNodeIds,
    linkIds: input.startLinkIds,
  };
  const transferData = Comlink.transfer(data, [
    ...topologyTransferables(data.topologyBuffers),
    ...assetIndexTransferables(data.assetIndexBuffers),
    ...flowDirectionTransferables(data.flowDirectionBuffers),
    ...allowedFlowDirectionTransferables(data.allowedFlowDirectionBuffers),
    ...activeTopologyTransferables(data.activeTopologyBuffers),
  ]);

  const workerAPI = getTraceWorker();
  try {
    const result = await workerAPI.runTrace(
      input.mode,
      start,
      transferData,
      anyStartIsActive(model.assets, start),
    );
    if (signal?.aborted) {
      throw new DOMException("Operation cancelled", "AbortError");
    }
    return result;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw enrichWorkerError("trace", e);
  }
};
