import { Topology } from "./topology";
import { AssetId } from "../asset-types/base-asset";

export const nodesShareLink = (
  topology: Topology,
  nodeId1: AssetId,
  nodeId2: AssetId,
): boolean => {
  const links1 = topology.getLinks(nodeId1);
  const links2 = topology.getLinks(nodeId2);
  return links1.some((linkId) => links2.includes(linkId));
};
