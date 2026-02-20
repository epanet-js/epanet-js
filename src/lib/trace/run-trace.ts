import * as Comlink from "comlink";

import { AssetId } from "src/hydraulic-model/asset-types";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { ResultsReader } from "src/simulation/results-reader";
import { canUseWorker } from "src/infra/worker";
import { encodeTraceBuffers } from "./encode-trace-buffers";
import { decodeTraceResult } from "./decode-trace-result";
import { TraceBuffers } from "./trace-buffers";
import { TraceMode, EncodedTraceResult } from "./types";
import { workerAPI as localWorkerAPI } from "./worker-api";
import type { TraceWorkerAPI, TraceStartIndices } from "./worker-api";

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

  const { buffers, nodeIdsLookup, linkIdsLookup } = encodeTraceBuffers(
    hydraulicModel,
    input.mode === "boundary" ? null : resultsReader,
    "array",
  );

  // Map asset IDs to buffer indices
  const nodeIdToIdx = new Map<number, number>();
  nodeIdsLookup.forEach((id, idx) => nodeIdToIdx.set(id, idx));
  const linkIdToIdx = new Map<number, number>();
  linkIdsLookup.forEach((id, idx) => linkIdToIdx.set(id, idx));

  const startIndices: TraceStartIndices = {
    nodeIndices: input.startNodeIds
      .map((id) => nodeIdToIdx.get(id))
      .filter((idx): idx is number => idx !== undefined),
    linkIndices: input.startLinkIds
      .map((id) => linkIdToIdx.get(id))
      .filter((idx): idx is number => idx !== undefined),
  };

  const encodedResult = canUseWorker()
    ? await runWithWorker(input.mode, startIndices, buffers, signal)
    : runSync(input.mode, startIndices, buffers);

  return decodeTraceResult(encodedResult, nodeIdsLookup, linkIdsLookup);
};

function runSync(
  mode: TraceMode,
  start: TraceStartIndices,
  buffers: TraceBuffers,
): EncodedTraceResult {
  return localWorkerAPI.runTrace(mode, start, buffers);
}

const runWithWorker = async (
  mode: TraceMode,
  start: TraceStartIndices,
  buffers: TraceBuffers,
  signal?: AbortSignal,
): Promise<EncodedTraceResult> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<TraceWorkerAPI>(worker);

  const abortHandler = () => worker.terminate();
  signal?.addEventListener("abort", abortHandler);

  try {
    return await workerAPI.runTrace(mode, start, buffers);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
