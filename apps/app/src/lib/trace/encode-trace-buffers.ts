import { HydraulicModel } from "src/hydraulic-model";
import { ResultsReader } from "@epanet-js/simulation";
import { BufferType, createBuffer } from "@epanet-js/buffers";
import {
  AssetIndexEncoder,
  AssetIndexBuffers,
} from "src/hydraulic-model/asset-index-transferable";
import {
  configuredActiveTopology,
  type AllowedFlowDirectionQueries,
  type AssetIndexQueries,
  type ActiveTopologyQueries,
} from "@epanet-js/hydraulic-model";
import {
  TopologyEncoder,
  TopologyBuffers,
} from "src/hydraulic-model/topology/topology-transferable";
import {
  FlowDirectionBuffers,
  AllowedFlowDirectionBuffers,
  ActiveTopologyBuffers,
} from "./trace-buffers";
import { FlowDirection } from "./flow-direction";
import { AllowedFlowDirection } from "./allowed-flow-direction";
import type { FlowDirectionQueries, TraceMode } from "./types";

export type TraceRunData = {
  topologyBuffers: TopologyBuffers;
  assetIndexBuffers: AssetIndexBuffers;
  flowDirectionBuffers: FlowDirectionBuffers | null;
  allowedFlowDirectionBuffers: AllowedFlowDirectionBuffers | null;
  activeTopologyBuffers: ActiveTopologyBuffers | null;
};

export function encodeTraceData(
  model: HydraulicModel,
  resultsReader: ResultsReader | null,
  mode: TraceMode,
  bufferType: BufferType = "array",
): TraceRunData {
  const assetIndexEncoder = new AssetIndexEncoder(model.assetIndex, bufferType);
  const topologyEncoder = new TopologyEncoder(
    model.topology,
    model.assetIndex,
    bufferType,
  );
  const flowDirectionStatus = new FlowDirection(model.assets, resultsReader);
  const flowDirectionEncoder = new FlowDirectionEncoder(
    model.assetIndex,
    flowDirectionStatus,
    bufferType,
  );
  const allowedFlowDirectionStatus = new AllowedFlowDirection(
    model.assets,
    resultsReader,
  );
  const allowedFlowDirectionEncoder = new AllowedFlowDirectionEncoder(
    model.assetIndex,
    allowedFlowDirectionStatus,
    bufferType,
  );

  return {
    topologyBuffers: topologyEncoder.encode(),
    assetIndexBuffers: assetIndexEncoder.encode(),
    flowDirectionBuffers:
      mode === "boundary" ? null : flowDirectionEncoder.encode(),
    allowedFlowDirectionBuffers:
      mode === "boundary" ? allowedFlowDirectionEncoder.encode() : null,
    activeTopologyBuffers:
      mode === "boundary"
        ? new ActiveTopologyEncoder(
            model.assetIndex,
            configuredActiveTopology(model.assets),
            bufferType,
          ).encode()
        : null,
  };
}

class ActiveTopologyEncoder {
  constructor(
    private assetIndex: AssetIndexQueries,
    private activeTopology: ActiveTopologyQueries,
    private bufferType: BufferType,
  ) {}

  encode(): ActiveTopologyBuffers {
    const activeLinks = createBuffer(
      this.assetIndex.linkCount,
      this.bufferType,
    );
    const activeNodes = createBuffer(
      this.assetIndex.nodeCount,
      this.bufferType,
    );
    const linksView = new Uint8Array(activeLinks);
    const nodesView = new Uint8Array(activeNodes);

    let linkIdx = 0;
    for (const [linkId] of this.assetIndex.iterateLinks()) {
      linksView[linkIdx] = this.activeTopology.isLinkActive(linkId) ? 1 : 0;
      linkIdx++;
    }

    let nodeIdx = 0;
    for (const [nodeId] of this.assetIndex.iterateNodes()) {
      nodesView[nodeIdx] = this.activeTopology.isNodeActive(nodeId) ? 1 : 0;
      nodeIdx++;
    }

    return { activeLinks, activeNodes };
  }
}

class AllowedFlowDirectionEncoder {
  constructor(
    private assetIndex: AssetIndexQueries,
    private status: AllowedFlowDirectionQueries,
    private bufferType: BufferType,
  ) {}

  encode(): AllowedFlowDirectionBuffers {
    const buffer = createBuffer(this.assetIndex.linkCount, this.bufferType);
    const view = new Uint8Array(buffer);

    let linkIdx = 0;
    for (const [linkId] of this.assetIndex.iterateLinks()) {
      view[linkIdx] = this.status.getAllowedFlowDirection(linkId);
      linkIdx++;
    }

    return { allowedFlowDirections: buffer };
  }
}

class FlowDirectionEncoder {
  constructor(
    private assetIndex: AssetIndexQueries,
    private status: FlowDirectionQueries,
    private bufferType: BufferType,
  ) {}

  encode(): FlowDirectionBuffers {
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

    return {
      flowDirections: flowDirectionsBuffer,
    };
  }
}
