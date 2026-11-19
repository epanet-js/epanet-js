import { BinaryData, BufferType, createBuffer } from "@epanet-js/buffers";
import {
  ActiveAssetIndex,
  ActiveTopology,
  AssetId,
  type AssetIndexQueries,
} from "@epanet-js/hydraulic-model";
import {
  configuredJunctionDemands,
  type JunctionDemandQueries,
  topologyFlowDirections,
} from "@epanet-js/network-review";
import { HydraulicModel } from "src/hydraulic-model";
import {
  AssetIndexBuffers,
  AssetIndexEncoder,
  AssetIndexView,
  assetIndexTransferables,
} from "src/hydraulic-model/asset-index-transferable";
import {
  TopologyBuffers,
  TopologyEncoder,
  topologyTransferables,
} from "src/hydraulic-model/topology/topology-transferable";
import { AllowedFlowDirectionEncoder } from "src/lib/trace/encode-trace-buffers";
import {
  AllowedFlowDirectionBuffers,
  allowedFlowDirectionTransferables,
} from "src/lib/trace/trace-buffers";

export interface JunctionDemandBuffers {
  carriesDemand: BinaryData;
}

export type RunData = {
  topologyBuffers: TopologyBuffers;
  assetIndexBuffers: AssetIndexBuffers;
  allowedFlowDirectionBuffers: AllowedFlowDirectionBuffers;
  junctionDemandBuffers: JunctionDemandBuffers;
};

export function encodeData(
  model: HydraulicModel,
  bufferType: BufferType = "array",
): RunData {
  const assetIndex = new ActiveAssetIndex(model.assetIndex, model.assets);
  const topology = new ActiveTopology(model.topology, model.assets);

  return {
    topologyBuffers: new TopologyEncoder(
      topology,
      assetIndex,
      bufferType,
    ).encode(),
    assetIndexBuffers: new AssetIndexEncoder(assetIndex, bufferType).encode(),
    allowedFlowDirectionBuffers: new AllowedFlowDirectionEncoder(
      assetIndex,
      topologyFlowDirections(model.assets),
      bufferType,
    ).encode(),
    junctionDemandBuffers: encodeJunctionDemands(
      assetIndex,
      configuredJunctionDemands(model),
      bufferType,
    ),
  };
}

export function runDataTransferables(data: RunData): ArrayBuffer[] {
  return [
    ...topologyTransferables(data.topologyBuffers),
    ...assetIndexTransferables(data.assetIndexBuffers),
    ...allowedFlowDirectionTransferables(data.allowedFlowDirectionBuffers),
    ...junctionDemandTransferables(data.junctionDemandBuffers),
  ];
}

export class JunctionDemandView implements JunctionDemandQueries {
  private flags: Uint8Array;

  constructor(
    buffers: JunctionDemandBuffers,
    private assetIndex: AssetIndexView,
  ) {
    this.flags = new Uint8Array(buffers.carriesDemand);
  }

  carriesDemand(junctionId: AssetId): boolean {
    const nodeIndex = this.assetIndex.getNodeIndex(junctionId);
    return nodeIndex !== null && this.flags[nodeIndex] === 1;
  }
}

const encodeJunctionDemands = (
  assetIndex: AssetIndexQueries,
  demands: JunctionDemandQueries,
  bufferType: BufferType,
): JunctionDemandBuffers => {
  const carriesDemand = createBuffer(assetIndex.nodeCount, bufferType);
  const flags = new Uint8Array(carriesDemand);

  for (const [nodeId, nodeIndex] of assetIndex.iterateNodes()) {
    if (assetIndex.getNodeType(nodeId) !== "junction") continue;
    flags[nodeIndex] = demands.carriesDemand(nodeId) ? 1 : 0;
  }

  return { carriesDemand };
};

const junctionDemandTransferables = (
  buffers: JunctionDemandBuffers,
): ArrayBuffer[] =>
  buffers.carriesDemand instanceof ArrayBuffer ? [buffers.carriesDemand] : [];
