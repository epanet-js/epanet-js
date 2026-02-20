import { TraceBuffers } from "./trace-buffers";
import { TraceMode, EncodedTraceResult } from "./types";
import { boundaryTrace } from "./boundary-trace";
import { upstreamTrace } from "./upstream-trace";
import { downstreamTrace } from "./downstream-trace";

export interface TraceStartIndices {
  nodeIndices: number[];
  linkIndices: number[];
}

export interface TraceWorkerAPI {
  runTrace: (
    mode: TraceMode,
    start: TraceStartIndices,
    buffers: TraceBuffers,
  ) => EncodedTraceResult;
}

export const workerAPI: TraceWorkerAPI = {
  runTrace: (mode, start, buffers) => {
    switch (mode) {
      case "boundary":
        return boundaryTrace(start, buffers);
      case "upstream":
        return upstreamTrace(start, buffers);
      case "downstream":
        return downstreamTrace(start, buffers);
    }
  },
};
