import { AssetIndexView } from "src/hydraulic-model/asset-index-transferable";
import { TopologyView } from "src/hydraulic-model/topology/topology-transferable";
import { TraceRunData } from "./encode-trace-buffers";
import { FlowDirectionView, AllowedFlowDirectionView } from "./trace-buffers";
import {
  boundaryBarriers,
  boundaryTraceDeprecated,
  trace,
  type TraceResult,
  type TraceStart,
} from "@epanet-js/hydraulic-model";
import { TraceMode } from "./types";
import { upstreamTrace } from "./upstream-trace";
import { downstreamTrace } from "./downstream-trace";

export interface TraceWorkerAPI {
  runTrace: (
    mode: TraceMode,
    start: TraceStart,
    data: TraceRunData,
    isScriptingOn: boolean,
  ) => TraceResult;
}

export const workerAPI: TraceWorkerAPI = {
  runTrace: (mode, start, data, isScriptingOn) => {
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
        return isScriptingOn
          ? trace(
              start,
              topology,
              allowedFlowDirection,
              boundaryBarriers(assetIndex, allowedFlowDirection),
            )
          : boundaryTraceDeprecated(
              start,
              topology,
              assetIndex,
              allowedFlowDirection,
            );
      case "upstream":
        return upstreamTrace(start, topology, flowDirection);
      case "downstream":
        return downstreamTrace(start, topology, flowDirection);
    }
  },
};
