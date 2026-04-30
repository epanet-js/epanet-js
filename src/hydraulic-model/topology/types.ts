import { AssetId } from "../asset-types/base-asset";
import { BinaryData, BufferWithIndex } from "src/lib/buffers";

export interface TopologyQueries {
  hasLink(linkId: AssetId): boolean;
  hasNode(nodeId: AssetId): boolean;
  getLinks(nodeId: AssetId): AssetId[];
  getNodes(linkId: AssetId): [AssetId, AssetId];
}

export type PathData = {
  nodeIds: AssetId[];
  linkIds: AssetId[];
  totalLength: number;
};

export interface TopologyBuffers {
  linkConnections: BinaryData;
  nodeConnections: BufferWithIndex;
}

export function topologyTransferables(b: TopologyBuffers): ArrayBuffer[] {
  return [
    b.linkConnections,
    b.nodeConnections.data,
    b.nodeConnections.index,
  ].filter((buf): buf is ArrayBuffer => buf instanceof ArrayBuffer);
}
