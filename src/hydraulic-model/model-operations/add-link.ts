import { NodeAsset, LinkAsset } from "../asset-types";
import distance from "@turf/distance";
import { ModelOperation } from "../model-operation";
import { Position } from "geojson";
import { LabelGenerator } from "../label-manager";

type InputData = {
  link: LinkAsset;
  startNode: NodeAsset;
  endNode: NodeAsset;
};

export const addLink: ModelOperation<InputData> = (
  hydraulicModel,
  { link, startNode, endNode },
) => {
  const linkCopy = link.copy();
  const startNodeCopy = startNode.copy();
  const endNodeCopy = endNode.copy();
  addMissingLabels(
    hydraulicModel.labelManager,
    linkCopy,
    startNodeCopy,
    endNodeCopy,
  );
  linkCopy.setConnections(startNodeCopy.id, endNodeCopy.id);
  removeRedundantVertices(linkCopy);
  forceSpatialConnectivity(linkCopy, startNodeCopy, endNodeCopy);

  return {
    note: `Add ${link.type}`,
    putAssets: [linkCopy, startNodeCopy, endNodeCopy],
  };
};

const addMissingLabels = (
  labelGenerator: LabelGenerator,
  link: LinkAsset,
  startNode: NodeAsset,
  endNode: NodeAsset,
) => {
  link.setProperty("label", labelGenerator.generateFor(link.type, link.id));
  if (startNode.label === "") {
    startNode.setProperty(
      "label",
      labelGenerator.generateFor(startNode.type, startNode.id),
    );
  }
  if (endNode.label === "") {
    endNode.setProperty(
      "label",
      labelGenerator.generateFor(endNode.type, endNode.id),
    );
  }
};

const removeRedundantVertices = (link: LinkAsset) => {
  const vertices = link.coordinates;
  let previous: Position | null = null;

  const result = [];
  for (const coordinates of vertices) {
    if (previous && isAlmostTheSamePoint(previous, coordinates)) {
      continue;
    }
    result.push(coordinates);
    previous = coordinates;
  }
  link.setCoordinates(result);
};

const forceSpatialConnectivity = (
  link: LinkAsset,
  startNode: NodeAsset,
  endNode: NodeAsset,
) => {
  const newCoordinates = [...link.coordinates];
  newCoordinates[0] = startNode.coordinates;
  newCoordinates[newCoordinates.length - 1] = endNode.coordinates;

  link.setCoordinates(newCoordinates);
};

const isAlmostTheSamePoint = (a: Position, b: Position) => {
  const minResolutionInMeters = 1;
  const distanceInMeters = distance(a, b) * 1000;
  return distanceInMeters <= minResolutionInMeters;
};
