import { AssetIndexView } from "src/hydraulic-model/asset-index-transferable";
import { TopologyView } from "src/hydraulic-model/topology/topology-transferable";
import { TraceRunData } from "./encode-trace-buffers";
import {
  FlowDirectionView,
  AllowedFlowDirectionView,
  ActiveTopologyView,
} from "./trace-buffers";
import {
  activeTopologyBarriers,
  anyBarrier,
  boundaryBarriers,
  trace,
  type TraceResult,
  type TraceStart,
} from "@epanet-js/hydraulic-model";
import { TraceMode } from "./types";
import { upstreamTrace, downstreamTrace } from "./flow-trace";

export interface TraceWorkerAPI {
  runTrace: (
    mode: TraceMode,
    start: TraceStart,
    data: TraceRunData,
    startsOnActiveAsset: boolean,
  ) => TraceResult;
}

export const workerAPI: TraceWorkerAPI = {
  runTrace: (mode, start, data, startsOnActiveAsset) => {
    const assetIndex = new AssetIndexView(data.assetIndexBuffers);
    const topology = new TopologyView(data.topologyBuffers, assetIndex);

    switch (mode) {
      case "boundary": {
        const allowedFlowDirection = new AllowedFlowDirectionView(
          data.allowedFlowDirectionBuffers!,
          assetIndex,
        );
        return trace(
          start,
          topology,
          anyBarrier(
            boundaryBarriers(topology, assetIndex, allowedFlowDirection),
            activeTopologyBarriers(
              new ActiveTopologyView(data.activeTopologyBuffers!, assetIndex),
              startsOnActiveAsset,
            ),
          ),
        );
      }
      case "upstream":
        return upstreamTrace(
          start,
          topology,
          new FlowDirectionView(data.flowDirectionBuffers!, assetIndex),
        );
      case "downstream":
        return downstreamTrace(
          start,
          topology,
          new FlowDirectionView(data.flowDirectionBuffers!, assetIndex),
        );
    }
  },
};
