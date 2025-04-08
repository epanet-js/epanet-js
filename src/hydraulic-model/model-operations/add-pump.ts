import { NodeAsset, LinkAsset, Pump } from "../asset-types";
import distance from "@turf/distance";
import { ModelOperation } from "../model-operation";
import { Position } from "geojson";
import { LabelGenerator } from "../label-manager";

type InputData = {
  pump: Pump;
  startNode: NodeAsset;
  endNode: NodeAsset;
};

export const addPump: ModelOperation<InputData> = (
  hydraulicModel,
  { pump, startNode, endNode },
) => {
  const pumpCopy = pump.copy();
  const startNodeCopy = startNode.copy();
  const endNodeCopy = endNode.copy();
  addMissingLabels(
    hydraulicModel.labelManager,
    pumpCopy,
    startNodeCopy,
    endNodeCopy,
  );
  pumpCopy.setConnections(startNodeCopy.id, endNodeCopy.id);
  removeRedundantVertices(pumpCopy);
  forceSpatialConnectivity(pumpCopy, startNodeCopy, endNodeCopy);

  return {
    note: "Add pump",
    putAssets: [pumpCopy, startNodeCopy, endNodeCopy],
  };
};

const addMissingLabels = (
  labelGenerator: LabelGenerator,
  pump: Pump,
  startNode: NodeAsset,
  endNode: NodeAsset,
) => {
  pump.setProperty("label", labelGenerator.generateFor("pump", pump.id));
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
