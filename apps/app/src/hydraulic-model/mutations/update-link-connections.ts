import { AssetId, LinkAsset } from "@epanet-js/hydraulic-model";

export const updateLinkConnections = (
  link: LinkAsset,
  oldNodeId: AssetId,
  newNodeId: AssetId,
): void => {
  const [startNodeId, endNodeId] = link.connections;
  if (startNodeId === oldNodeId) {
    link.setConnections(newNodeId, endNodeId);
  } else if (endNodeId === oldNodeId) {
    link.setConnections(startNodeId, newNodeId);
  }
};
