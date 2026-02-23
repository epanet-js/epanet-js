import { AssetIndexView } from "src/hydraulic-model/asset-index";
import { TopologyView } from "src/hydraulic-model/topology/topologyView";
import { TraceRunData } from "./encode-trace-buffers";
import { FlowDirectionView, AllowedFlowDirectionView } from "./trace-buffers";
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
    const flowDirection = new FlowDirectionView(
      data.flowDirectionBuffers,
      assetIndex,
    );
    const allowedFlowDirection = new AllowedFlowDirectionView(
      data.allowedFlowDirectionBuffers,
      assetIndex,
    );

    switch (mode) {
      case "boundary":
        return boundaryTrace(start, topology, assetIndex, allowedFlowDirection);
      case "upstream":
        return upstreamTrace(start, topology, flowDirection);
      case "downstream":
        return downstreamTrace(start, topology, flowDirection);
    }
  },
};
