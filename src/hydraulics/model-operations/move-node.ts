import { Position } from "geojson";
import { AssetId, LinkType, NodeType } from "../asset-types";
import { AssetsMap, getNode, getLink } from "../assets-map";
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
  const node = getNode(assets, nodeId) as NodeType;
  const oldCoordinates = node.coordinates;

  const updatedNode = node.copy();
  updatedNode.setCoordinates(newCoordinates);
  updatedNode.setElevation(newElevation);

  const linkIds = topology.getLinks(node.id);

  const updatedLinks = updateMatchingEndpoints(
    assets,
    linkIds,
    oldCoordinates,
    newCoordinates,
  );

  return { note: "Move node", putAssets: [updatedNode, ...updatedLinks] };
};

const updateMatchingEndpoints = (
  assets: AssetsMap,
  linkIds: AssetId[],
  oldCoordinates: Position,
  newCoordinates: Position,
) => {
  const updatedLinks = [];
  for (const linkId of linkIds) {
    const link = getLink(assets, linkId) as LinkType;
    const linkCopy = link.copy();

    const newLinkCoordinates = [...linkCopy.coordinates];
    if (linkCopy.isStart(oldCoordinates)) {
      newLinkCoordinates[0] = newCoordinates;
    }
    if (linkCopy.isEnd(oldCoordinates)) {
      newLinkCoordinates[newLinkCoordinates.length - 1] = newCoordinates;
    }

    linkCopy.setCoordinates(newLinkCoordinates);
    updatedLinks.push(linkCopy);
  }
  return updatedLinks;
};
