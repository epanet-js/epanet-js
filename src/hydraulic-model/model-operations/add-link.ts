import { NodeAsset, LinkAsset, AssetId } from "../asset-types";
import { Pipe } from "../asset-types/pipe";
import distance from "@turf/distance";
import { ModelOperation } from "../model-operation";
import { Position } from "geojson";
import { LabelGenerator } from "../label-manager";
import { splitPipe } from "./split-pipe";

type InputData = {
  link: LinkAsset;
  startNode: NodeAsset;
  endNode: NodeAsset;
  startPipeId?: AssetId;
  endPipeId?: AssetId;
};

export const addLink: ModelOperation<InputData> = (
  hydraulicModel,
  { link, startNode, endNode, startPipeId, endPipeId },
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

  const allPutAssets = [linkCopy, startNodeCopy, endNodeCopy];
  const allPutCustomerPoints = [];
  const allDeleteAssets: AssetId[] = [];

  if (startPipeId && endPipeId && startPipeId === endPipeId) {
    const pipe = hydraulicModel.assets.get(startPipeId) as Pipe;
    if (!pipe || pipe.type !== "pipe") {
      throw new Error(`Invalid pipe ID: ${startPipeId}`);
    }
    const splitResult = splitPipe(hydraulicModel, {
      pipe,
      splits: [startNodeCopy, endNodeCopy],
    });
    allPutAssets.push(...splitResult.putAssets!);
    allPutCustomerPoints.push(...(splitResult.putCustomerPoints || []));
    allDeleteAssets.push(...splitResult.deleteAssets!);
  } else {
    if (startPipeId) {
      const startPipe = hydraulicModel.assets.get(startPipeId) as Pipe;
      if (!startPipe || startPipe.type !== "pipe") {
        throw new Error(`Invalid pipe ID: ${startPipeId}`);
      }
      const startPipeSplitResult = splitPipe(hydraulicModel, {
        pipe: startPipe,
        splits: [startNodeCopy],
      });
      allPutAssets.push(...startPipeSplitResult.putAssets!);
      allPutCustomerPoints.push(
        ...(startPipeSplitResult.putCustomerPoints || []),
      );
      allDeleteAssets.push(...startPipeSplitResult.deleteAssets!);
    }

    if (endPipeId) {
      const endPipe = hydraulicModel.assets.get(endPipeId) as Pipe;
      if (!endPipe || endPipe.type !== "pipe") {
        throw new Error(`Invalid pipe ID: ${endPipeId}`);
      }
      const endPipeSplitResult = splitPipe(hydraulicModel, {
        pipe: endPipe,
        splits: [endNodeCopy],
      });
      allPutAssets.push(...endPipeSplitResult.putAssets!);
      allPutCustomerPoints.push(
        ...(endPipeSplitResult.putCustomerPoints || []),
      );
      allDeleteAssets.push(...endPipeSplitResult.deleteAssets!);
    }
  }

  return {
    note: `Add ${link.type}`,
    putAssets: allPutAssets,
    deleteAssets: allDeleteAssets.length > 0 ? allDeleteAssets : undefined,
    putCustomerPoints: allPutCustomerPoints,
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
