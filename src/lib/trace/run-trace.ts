import * as Comlink from "comlink";

import { AssetId } from "src/hydraulic-model/asset-types";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { ResultsReader } from "src/simulation/results-reader";
import { canUseWorker, enrichWorkerError } from "src/infra/worker";
import { encodeTraceData } from "./encode-trace-buffers";
import {
  flowDirectionTransferables,
  allowedFlowDirectionTransferables,
} from "./trace-buffers";
import { topologyTransferables } from "src/hydraulic-model/topology/types";
import { assetIndexTransferables } from "src/hydraulic-model/asset-index";
import { FlowDirection } from "./flow-direction";
import { AllowedFlowDirection } from "./allowed-flow-direction";
import { TraceMode, TraceStart, TraceResult } from "./types";
import { boundaryTrace } from "./boundary-trace";
import { upstreamTrace } from "./upstream-trace";
import { downstreamTrace } from "./downstream-trace";
import type { TraceWorkerAPI } from "./worker-api";

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

  const effectiveResultsReader =
    input.mode === "boundary" ? null : resultsReader;

  const result = canUseWorker()
    ? await runWithWorker(hydraulicModel, effectiveResultsReader, input, signal)
    : runSync(hydraulicModel, effectiveResultsReader, input);

  return [...result.nodeIds, ...result.linkIds];
};

function runSync(
  model: HydraulicModel,
  resultsReader: ResultsReader | null,
  input: TraceInput,
): TraceResult {
  const status = new FlowDirection(model.assets, resultsReader);
  const allowedFlowDirection = new AllowedFlowDirection(
    model.assets,
    resultsReader,
  );
  const start: TraceStart = {
    nodeIds: input.startNodeIds,
    linkIds: input.startLinkIds,
  };

  switch (input.mode) {
    case "boundary":
      return boundaryTrace(
        start,
        model.topology,
        model.assetIndex,
        allowedFlowDirection,
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

  const data = encodeTraceData(model, resultsReader, "array");
  const start: TraceStart = {
    nodeIds: input.startNodeIds,
    linkIds: input.startLinkIds,
  };

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<TraceWorkerAPI>(worker);

  const abortHandler = () => worker.terminate();
  signal?.addEventListener("abort", abortHandler);

  try {
    return await workerAPI.runTrace(
      input.mode,
      start,
      Comlink.transfer(data, [
        ...topologyTransferables(data.topologyBuffers),
        ...assetIndexTransferables(data.assetIndexBuffers),
        ...flowDirectionTransferables(data.flowDirectionBuffers),
        ...allowedFlowDirectionTransferables(data.allowedFlowDirectionBuffers),
      ]),
    );
  } catch (e) {
    throw enrichWorkerError("trace", e);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
