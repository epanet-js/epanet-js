import { HydraulicModel } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation/results-reader";
import {
  BufferType,
  DataSize,
  FixedSizeBufferBuilder,
  createBuffer,
  encodeType,
} from "src/lib/buffers";
import {
  AssetIndexEncoder,
  AssetIndexBuffers,
  type AssetIndexQueries,
} from "src/hydraulic-model/asset-index";
import { TopologyEncoder } from "src/hydraulic-model/topology/topologyEncoder";
import { TopologyBuffers } from "src/hydraulic-model/topology/types";
import { TraceStatusBuffers } from "./trace-buffers";
import { TraceStatus } from "./trace-status";
import type { TraceStatusQueries } from "./types";

export type TraceRunData = {
  topologyBuffers: TopologyBuffers;
  assetIndexBuffers: AssetIndexBuffers;
  traceStatusBuffers: TraceStatusBuffers;
};

export function encodeTraceData(
  model: HydraulicModel,
  resultsReader: ResultsReader | null,
  bufferType: BufferType = "array",
): TraceRunData {
  const assetIndexEncoder = new AssetIndexEncoder(model.assetIndex, bufferType);
  const topologyEncoder = new TopologyEncoder(
    model.topology,
    model.assetIndex,
    bufferType,
  );
  const status = new TraceStatus(model.assets, resultsReader);
  const traceStatusEncoder = new TraceStatusEncoder(
    model.assetIndex,
    status,
    bufferType,
  );

  return {
    topologyBuffers: topologyEncoder.encode(),
    assetIndexBuffers: assetIndexEncoder.encode(),
    traceStatusBuffers: traceStatusEncoder.encode(),
  };
}

class TraceStatusEncoder {
  constructor(
    private assetIndex: AssetIndexQueries,
    private status: TraceStatusQueries,
    private bufferType: BufferType,
  ) {}

  encode(): TraceStatusBuffers {
    const linkTraversal = new FixedSizeBufferBuilder<number>(
      DataSize.type,
      this.assetIndex.linkCount,
      this.bufferType,
      encodeType,
    );

    const nodeTraversal = new FixedSizeBufferBuilder<number>(
      DataSize.type,
      this.assetIndex.nodeCount,
      this.bufferType,
      encodeType,
    );

    const flowDirectionsBuffer = createBuffer(
      this.assetIndex.linkCount,
      this.bufferType,
    );
    const flowDirectionsView = new Uint8Array(flowDirectionsBuffer);

    let linkIdx = 0;
    for (const [linkId] of this.assetIndex.iterateLinks()) {
      flowDirectionsView[linkIdx] = this.status.getFlowDirection(linkId);
      linkIdx++;
    }

    for (const [linkId] of this.assetIndex.iterateLinks()) {
      linkTraversal.add(this.status.getLinkTraversal(linkId));
    }

    for (const [nodeId] of this.assetIndex.iterateNodes()) {
      nodeTraversal.add(this.status.getNodeTraversal(nodeId));
    }

    return {
      linkTraversal: linkTraversal.finalize(),
      nodeTraversal: nodeTraversal.finalize(),
      flowDirections: flowDirectionsBuffer,
    };
  }
}
