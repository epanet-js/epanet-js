import { Pipe, NodeAsset, LinkAsset } from "../asset-types";
import distance from "@turf/distance";
import { ModelOperation } from "../model-operation";
import { Position } from "geojson";
import { isFeatureOn } from "src/infra/feature-flags";

type InputData = {
  pipe: Pipe;
  startNode: NodeAsset;
  endNode: NodeAsset;
};

export const addPipe: ModelOperation<InputData> = (
  hydraulicModel,
  { pipe, startNode, endNode },
) => {
  const pipeCopy = pipe.copy();
  const startNodeCopy = startNode.copy();
  const endNodeCopy = endNode.copy();
  if (isFeatureOn("FLAG_LABEL_TYPE")) {
    pipeCopy.setProperty(
      "label",
      hydraulicModel.assetBuilder.labelManager.generateFor("pipe", pipeCopy.id),
    );
    if (startNodeCopy.label === "") {
      startNodeCopy.setProperty(
        "label",
        hydraulicModel.assetBuilder.labelManager.generateFor(
          startNodeCopy.type,
          startNodeCopy.id,
        ),
      );
    }
    if (endNodeCopy.label === "") {
      endNodeCopy.setProperty(
        "label",
        hydraulicModel.assetBuilder.labelManager.generateFor(
          endNodeCopy.type,
          endNodeCopy.id,
        ),
      );
    }
  }
  pipeCopy.setConnections(startNodeCopy.id, endNodeCopy.id);
  removeRedundantVertices(pipeCopy);
  forceSpatialConnectivity(pipeCopy, startNodeCopy, endNodeCopy);

  return {
    note: "Add pipe",
    putAssets: [pipeCopy, startNodeCopy, endNodeCopy],
  };
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
