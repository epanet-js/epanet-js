import { InternalId } from "../asset-types/base-asset";
import { BinaryData, BufferWithIndex } from "src/lib/buffers";

export interface TopologyBaseQueries {
  hasLink(linkId: InternalId): boolean;
  hasNode(nodeId: InternalId): boolean;
  getLinks(nodeId: InternalId): InternalId[];
  getNodes(linkId: InternalId): [InternalId, InternalId];
}

export interface TopologyBuffers {
  linkConnections: BinaryData;
  nodeConnections: BufferWithIndex;
}
