import { Position } from "geojson";
import {
  AssetId,
  AssetsMap,
  LinkAsset,
  NodeAsset,
  assignElevation,
  getNodeCoordinates,
  updateMatchingEndpoints,
  updateNodeCoordinates,
} from "../assets";
import { ModelOperation } from "../model-operation";

type InputData = {
  nodeId: AssetId;
  newCoordinates: Position;
  newElevation: number;
};

export const moveNode: ModelOperation<InputData> = (
  { assets, topology },
  { nodeId, newCoordinates, newElevation },
) => {
  const node = assets.get(nodeId) as NodeAsset;
  const oldCoordinates = getNodeCoordinates(node);

  let updatedNode = updateNodeCoordinates(node, newCoordinates);
  updatedNode = assignElevation(updatedNode, newElevation);

  const linkIds = topology.getLinks(node.id);

  const updatedLinks = updateLinkCoordinates(
    assets,
    linkIds,
    oldCoordinates,
    newCoordinates,
  );

  return { note: "Move node", putAssets: [updatedNode, ...updatedLinks] };
};

const updateLinkCoordinates = (
  assets: AssetsMap,
  linkIds: AssetId[],
  oldCoordinates: Position,
  newCoordinates: Position,
) => {
  const updatedLinks = [];
  for (const linkId of linkIds) {
    const link = assets.get(linkId) as LinkAsset;

    updatedLinks.push(
      updateMatchingEndpoints(link, oldCoordinates, newCoordinates),
    );
  }
  return updatedLinks;
};
