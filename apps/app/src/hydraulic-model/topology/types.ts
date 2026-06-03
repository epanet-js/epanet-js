import { AssetId } from "@epanet-js/hydraulic-model";

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
