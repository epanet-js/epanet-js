import { AssetId } from "../asset-types/base-asset";
import { BinaryData, BufferWithIndex } from "src/lib/buffers";

export interface TopologyQueries {
  hasLink(linkId: AssetId): boolean;
  hasNode(nodeId: AssetId): boolean;
  getLinks(nodeId: AssetId): AssetId[];
  getNodes(linkId: AssetId): [AssetId, AssetId];
}

export interface TopologyBuffers {
  linkConnections: BinaryData;
  nodeConnections: BufferWithIndex;
}
