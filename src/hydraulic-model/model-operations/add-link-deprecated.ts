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

export const addLinkDeprecated: ModelOperation<InputData> = (
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
  forceSpatialConnectivity(linkCopy, startNodeCopy, endNodeCopy);
  removeRedundantVertices(linkCopy);

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
  if (vertices.length <= 2) {
    return;
  }
  const start = vertices[0];
  const end = vertices[vertices.length - 1];

  const result = [start];

  for (let i = 1; i < vertices.length - 1; i++) {
    const prev = result[result.length - 1];
    const current = vertices[i];
    if (!isAlmostTheSamePoint(prev, current)) {
      result.push(current);
    }
  }

  const lastInResult = result[result.length - 1];
  if (isAlmostTheSamePoint(lastInResult, end) && result.length >= 2) {
    result[result.length - 1] = end;
  } else {
    result.push(end);
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
