import { AssetId } from "src/hydraulic-model";

export interface SubNetwork {
  subnetworkId: number;
  nodeIds: AssetId[];
  linkIds: AssetId[];
  supplySourceCount: number;
  pipeCount: number;
  bounds: [number, number, number, number];
}

export type EncodedSubNetwork = {
  subnetworkId: number;
  nodeIndices: number[];
  linkIndices: number[];
  supplySourceCount: number;
  pipeCount: number;
  bounds: [number, number, number, number];
};

export function decodeSubNetworks(
  nodeIdsLookup: number[],
  linkIdsLookup: number[],
  encodedSubNetworks: EncodedSubNetwork[],
): SubNetwork[] {
  return encodedSubNetworks.map((subNetwork) => ({
    subnetworkId: subNetwork.subnetworkId,
    nodeIds: subNetwork.nodeIndices.map((idx) => nodeIdsLookup[idx]),
    linkIds: subNetwork.linkIndices.map((idx) => linkIdsLookup[idx]),
    supplySourceCount: subNetwork.supplySourceCount,
    pipeCount: subNetwork.pipeCount,
    bounds: subNetwork.bounds,
  }));
}
