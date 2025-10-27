import { AssetId } from "src/hydraulic-model";
import { BinaryData, BufferWithIndex } from "../shared";

export interface SubNetwork {
  subnetworkId: number;
  nodeIds: AssetId[];
  linkIds: AssetId[];
  supplySourceCount: number;
  pipeCount: number;
  bounds: [number, number, number, number];
}

export type RunData = {
  linksConnections: BinaryData;
  nodesConnections: BufferWithIndex;
  nodeTypes: BinaryData;
  linkTypes: BinaryData;
  linkBounds: BinaryData;
};

export type EncodedSubNetworks = {
  subnetworks: {
    subnetworkId: number;
    nodeIndices: number[];
    linkIndices: number[];
    supplySourceCount: number;
    pipeCount: number;
    bounds: [number, number, number, number];
  }[];
};

export function decodeSubNetworks(
  nodeIdsLookup: string[],
  linkIdsLookup: string[],
  encodedSubNetworks: EncodedSubNetworks,
): SubNetwork[] {
  return encodedSubNetworks.subnetworks.map((component) => ({
    subnetworkId: component.subnetworkId,
    nodeIds: component.nodeIndices.map((idx) => nodeIdsLookup[idx]),
    linkIds: component.linkIndices.map((idx) => linkIdsLookup[idx]),
    supplySourceCount: component.supplySourceCount,
    pipeCount: component.pipeCount,
    bounds: component.bounds,
  }));
}
