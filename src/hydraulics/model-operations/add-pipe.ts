import {
  LinkAsset,
  NodeAsset,
  Pipe,
  attachConnections,
  getLinkCoordinates,
  getNodeCoordinates,
  updateLinkCoordinates,
} from "../assets";
import distance from "@turf/distance";
import { ModelOperation } from "../model-operation";
import { Position } from "geojson";

type InputData = {
  pipe: Pipe;
  startNode: NodeAsset;
  endNode: NodeAsset;
};

export const addPipe: ModelOperation<InputData> = (
  hydraulicModel,
  { pipe, startNode, endNode },
) => {
  let pipeReady = attachConnections(pipe, startNode.id, endNode.id);
  pipeReady = removeRedundantVertices(pipeReady);
  pipeReady = forceSpatialConnectivity(pipeReady, startNode, endNode);
  return {
    note: "Add pipe",
    putAssets: [pipeReady, startNode, endNode],
  };
};

const forceSpatialConnectivity = (
  link: LinkAsset,
  startNode: NodeAsset,
  endNode: NodeAsset,
) => {
  const newCoordinates = [...getLinkCoordinates(link)];
  newCoordinates[0] = getNodeCoordinates(startNode);
  newCoordinates[newCoordinates.length - 1] = getNodeCoordinates(endNode);

  return updateLinkCoordinates(link, newCoordinates);
};

const removeRedundantVertices = (link: LinkAsset): LinkAsset => {
  const vertices = getLinkCoordinates(link);
  let previous: Position | null = null;

  const result = [];
  for (const coordinates of vertices) {
    if (previous && isAlmostTheSamePoint(previous, coordinates)) {
      continue;
    }
    result.push(coordinates);
    previous = coordinates;
  }
  return updateLinkCoordinates(link, result);
};

const isAlmostTheSamePoint = (a: Position, b: Position) => {
  const minResolutionInMeters = 1;
  const distanceInMeters = distance(a, b) * 1000;
  return distanceInMeters <= minResolutionInMeters;
};
