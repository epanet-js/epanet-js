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
import type { FlowDirectionQueries } from "./types";

export type TraceRunData = {
  topologyBuffers: TopologyBuffers;
  assetIndexBuffers: AssetIndexBuffers;
  flowDirectionBuffers: FlowDirectionBuffers;
  allowedFlowDirectionBuffers: AllowedFlowDirectionBuffers;
  activeTopologyBuffers: ActiveTopologyBuffers;
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
  const activeTopologyEncoder = new ActiveTopologyEncoder(
    model.assetIndex,
    configuredActiveTopology(model.assets),
    bufferType,
  );

  return {
    topologyBuffers: topologyEncoder.encode(),
    assetIndexBuffers: assetIndexEncoder.encode(),
    flowDirectionBuffers: flowDirectionEncoder.encode(),
    allowedFlowDirectionBuffers: allowedFlowDirectionEncoder.encode(),
    activeTopologyBuffers: activeTopologyEncoder.encode(),
  };
}

class ActiveTopologyEncoder {
  constructor(
    private assetIndex: AssetIndexQueries,
    private links: ActiveTopologyQueries,
    private bufferType: BufferType,
  ) {}

  encode(): ActiveTopologyBuffers {
    const buffer = createBuffer(this.assetIndex.linkCount, this.bufferType);
    const view = new Uint8Array(buffer);

    let linkIdx = 0;
    for (const [linkId] of this.assetIndex.iterateLinks()) {
      view[linkIdx] = this.links.isLinkActive(linkId) ? 1 : 0;
      linkIdx++;
    }

    return { activeTopology: buffer };
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
