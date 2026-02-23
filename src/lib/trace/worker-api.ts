import { AssetIndexView } from "src/hydraulic-model/asset-index";
import { TopologyView } from "src/hydraulic-model/topology/topologyView";
import { TraceRunData } from "./encode-trace-buffers";
import { TraceStatusView } from "./trace-buffers";
import { TraceMode, TraceStart, TraceResult } from "./types";
import { boundaryTrace } from "./boundary-trace";
import { upstreamTrace } from "./upstream-trace";
import { downstreamTrace } from "./downstream-trace";

export interface TraceWorkerAPI {
  runTrace: (
    mode: TraceMode,
    start: TraceStart,
    data: TraceRunData,
  ) => TraceResult;
}

export const workerAPI: TraceWorkerAPI = {
  runTrace: (mode, start, data) => {
    const assetIndex = new AssetIndexView(data.assetIndexBuffers);
    const topology = new TopologyView(data.topologyBuffers, assetIndex);
    const status = new TraceStatusView(data.traceStatusBuffers, assetIndex);

    switch (mode) {
      case "boundary":
        return boundaryTrace(start, topology, status);
      case "upstream":
        return upstreamTrace(start, topology, status);
      case "downstream":
        return downstreamTrace(start, topology, status);
    }
  },
};
