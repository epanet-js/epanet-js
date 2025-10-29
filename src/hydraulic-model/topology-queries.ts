import { Topology } from "./topology";

export const nodesShareLink = (
  topology: Topology,
  nodeId1: string,
  nodeId2: string,
): boolean => {
  const links1 = topology.getLinks(nodeId1);
  const links2 = topology.getLinks(nodeId2);
  return links1.some((linkId) => links2.includes(linkId));
};
