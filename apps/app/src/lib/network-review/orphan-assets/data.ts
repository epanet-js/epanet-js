import { HydraulicModel } from "src/hydraulic-model";
import { BufferType } from "@epanet-js/buffers";
import {
  TopologyEncoder,
  TopologyBuffers,
} from "src/hydraulic-model/topology/topology-transferable";
import {
  AssetIndexEncoder,
  AssetIndexBuffers,
} from "src/hydraulic-model/asset-index-transferable";
import { ActiveAssetIndex, ActiveTopology } from "@epanet-js/hydraulic-model";

export type RunData = {
  topologyBuffers: TopologyBuffers;
  assetIndexBuffers: AssetIndexBuffers;
};

export function encodeData(
  model: HydraulicModel,
  bufferType: BufferType = "array",
): RunData {
  const assetIndex = new ActiveAssetIndex(model.assetIndex, model.assets);
  const topology = new ActiveTopology(model.topology, model.assets);

  const assetIndexEncoder = new AssetIndexEncoder(assetIndex, bufferType);
  const topologyEncoder = new TopologyEncoder(topology, assetIndex, bufferType);

  return {
    topologyBuffers: topologyEncoder.encode(),
    assetIndexBuffers: assetIndexEncoder.encode(),
  };
}
