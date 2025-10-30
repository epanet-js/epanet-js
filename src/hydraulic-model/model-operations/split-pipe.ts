import { NodeAsset } from "../asset-types";
import { Pipe, PipeProperties } from "../asset-types/pipe";
import { ModelOperation } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { CustomerPoint } from "../customer-points";
import { findJunctionForCustomerPoint } from "../utilities/junction-assignment";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "src/lib/geometry";
import measureLength from "@turf/length";
import { Position } from "src/types";

type CopyablePipeProperties = Pick<
  PipeProperties,
  "diameter" | "roughness" | "minorLoss" | "initialStatus"
>;
type CopyablePipePropertyKeys = keyof CopyablePipeProperties;

type SplitPipeInput = {
  pipe: Pipe;
  splits: NodeAsset[];
};

export const splitPipe: ModelOperation<SplitPipeInput> = (
  hydraulicModel,
  { pipe, splits },
) => {
  if (splits.length === 0) {
    throw new Error("At least one split is required");
  }

  const newPipes = splitPipeIteratively(hydraulicModel, pipe, splits);

  const reconnectedCustomerPoints = updateCustomerPoints(
    hydraulicModel,
    pipe,
    splits,
    newPipes,
  );

  return {
    note: `Split pipe`,
    putAssets: newPipes,
    deleteAssets: [pipe.id],
    putCustomerPoints:
      reconnectedCustomerPoints.length > 0
        ? reconnectedCustomerPoints
        : undefined,
  };
};

const updateCustomerPoints = (
  hydraulicModel: HydraulicModel,
  originalPipe: Pipe,
  splits: NodeAsset[],
  newPipes: Pipe[],
): CustomerPoint[] => {
  const tempAssets = new Map(hydraulicModel.assets);
  for (const splitNode of splits) {
    tempAssets.set(splitNode.id, splitNode);
  }

  const connectedCustomerPoints =
    hydraulicModel.customerPointsLookup.getCustomerPoints(originalPipe.id);
  const reconnectedCustomerPoints: CustomerPoint[] = [];

  if (connectedCustomerPoints.size > 0) {
    for (const customerPoint of connectedCustomerPoints) {
      if (customerPoint.connection?.snapPoint) {
        const targetPipe = findTargetPipeForCustomerPoint(
          newPipes,
          customerPoint.connection.snapPoint as [number, number],
        );
        if (targetPipe) {
          const reconnectedPoint = reconnectCustomerPointToPipe(
            customerPoint,
            targetPipe,
            tempAssets,
          );
          if (reconnectedPoint) {
            reconnectedCustomerPoints.push(reconnectedPoint);
          }
        }
      }
    }
  }

  return reconnectedCustomerPoints;
};

const findPipeContainingSplit = (pipes: Pipe[], split: NodeAsset): number => {
  let bestPipeIndex = 0;
  let minDistance = Number.MAX_VALUE;

  for (let i = 0; i < pipes.length; i++) {
    const pipe = pipes[i];
    const line = lineString(pipe.coordinates);
    const splitPoint = point(split.coordinates);

    const nearestPoint = findNearestPointOnLine(line, splitPoint);

    if (nearestPoint.distance !== null && nearestPoint.distance < minDistance) {
      minDistance = nearestPoint.distance;
      bestPipeIndex = i;
    }
  }

  return bestPipeIndex;
};

const splitPipeIteratively = (
  hydraulicModel: HydraulicModel,
  originalPipe: Pipe,
  splits: NodeAsset[],
): Pipe[] => {
  if (splits.length === 0) {
    return [originalPipe];
  }

  const baseLabel = originalPipe.label;
  const currentPipes = [originalPipe];
  let remainingSplits = [...splits];

  while (remainingSplits.length > 0) {
    const splitToProcess = remainingSplits[0];

    const targetPipeIndex = findPipeContainingSplit(
      currentPipes,
      splitToProcess,
    );
    const targetPipe = currentPipes[targetPipeIndex];

    const [pipe1, pipe2] = splitPipeAtPoint(
      hydraulicModel,
      targetPipe,
      splitToProcess,
    );

    currentPipes.splice(targetPipeIndex, 1, pipe1, pipe2);

    remainingSplits = remainingSplits.slice(1);
  }

  relabelPipes(hydraulicModel, currentPipes, baseLabel);

  return currentPipes;
};

const relabelPipes = (
  hydraulicModel: HydraulicModel,
  pipes: Pipe[],
  baseLabel: string,
): void => {
  if (pipes.length === 0) return;

  pipes[0].setProperty("label", baseLabel);

  for (let i = 1; i < pipes.length; i++) {
    const newLabel = hydraulicModel.labelManager.generateNextLabel(
      i === 1 ? baseLabel : pipes[i - 1].label,
    );
    pipes[i].setProperty("label", newLabel);
  }
};

const splitPipeAtPoint = (
  hydraulicModel: HydraulicModel,
  pipe: Pipe,
  split: NodeAsset,
): [Pipe, Pipe] => {
  const matchingVertexIndex = findMatchingVertexIndex(
    pipe.coordinates,
    split.coordinates,
  );

  if (isValidVertexSplit(matchingVertexIndex, pipe.coordinates.length)) {
    return splitPipeAtVertex(hydraulicModel, pipe, split, matchingVertexIndex);
  }

  const segmentIndex = findNearestSegment(pipe.coordinates, split.coordinates);
  return splitPipeAtNewPoint(hydraulicModel, pipe, split, segmentIndex);
};

const splitPipeAtVertex = (
  hydraulicModel: HydraulicModel,
  pipe: Pipe,
  split: NodeAsset,
  vertexIndex: number,
): [Pipe, Pipe] => {
  const coords1 = pipe.coordinates.slice(0, vertexIndex + 1);
  const coords2 = pipe.coordinates.slice(vertexIndex);

  return buildPipePair(hydraulicModel, pipe, split, coords1, coords2);
};

const splitPipeAtNewPoint = (
  hydraulicModel: HydraulicModel,
  pipe: Pipe,
  split: NodeAsset,
  segmentIndex: number,
): [Pipe, Pipe] => {
  const coords1 = [
    ...pipe.coordinates.slice(0, segmentIndex + 1),
    split.coordinates,
  ];
  const coords2 = [
    split.coordinates,
    ...pipe.coordinates.slice(segmentIndex + 1),
  ];

  return buildPipePair(hydraulicModel, pipe, split, coords1, coords2);
};

const findMatchingVertexIndex = (
  coordinates: Position[],
  splitCoords: Position,
): number => {
  return coordinates.findIndex(
    (coord) => coord[0] === splitCoords[0] && coord[1] === splitCoords[1],
  );
};

const isValidVertexSplit = (
  vertexIndex: number,
  totalVertices: number,
): boolean => {
  return (
    vertexIndex !== -1 && vertexIndex > 0 && vertexIndex < totalVertices - 1
  );
};

const findNearestSegment = (
  coordinates: Position[],
  splitCoords: Position,
): number => {
  const splitPoint = point(splitCoords);
  let splitIndex = -1;
  let minDistance = Number.MAX_VALUE;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const segmentLine = lineString([coordinates[i], coordinates[i + 1]]);
    const segmentNearest = findNearestPointOnLine(segmentLine, splitPoint);

    if (
      segmentNearest.distance !== null &&
      segmentNearest.distance < minDistance
    ) {
      minDistance = segmentNearest.distance;
      splitIndex = i;
    }
  }

  if (splitIndex === -1) {
    splitIndex = Math.floor((coordinates.length - 1) / 2);
  }

  return splitIndex;
};

const buildPipePair = (
  hydraulicModel: HydraulicModel,
  originalPipe: Pipe,
  split: NodeAsset,
  coords1: Position[],
  coords2: Position[],
): [Pipe, Pipe] => {
  const [originalStartNodeId, originalEndNodeId] = originalPipe.connections;

  const pipe1 = hydraulicModel.assetBuilder.buildPipe({
    label: originalPipe.label,
    coordinates: coords1,
    connections: [originalStartNodeId, split.id],
  });

  const pipe2 = hydraulicModel.assetBuilder.buildPipe({
    label: originalPipe.label,
    coordinates: coords2,
    connections: [split.id, originalEndNodeId],
  });

  copyPipeProperties(originalPipe, pipe1);
  copyPipeProperties(originalPipe, pipe2);
  updatePipeLength(pipe1);
  updatePipeLength(pipe2);

  return [pipe1, pipe2];
};

const copyPipeProperties = (source: Pipe, target: Pipe) => {
  const propertiesToCopy: CopyablePipePropertyKeys[] = [
    "diameter",
    "roughness",
    "minorLoss",
    "initialStatus",
  ];

  for (const property of propertiesToCopy) {
    if (source.hasProperty(property)) {
      const value = source.getProperty(property);
      if (value !== null && value !== undefined) {
        target.setProperty(property, value);
      }
    }
  }
};

const updatePipeLength = (pipe: Pipe) => {
  const length = measureLength(pipe.feature, { units: "meters" });
  pipe.setProperty("length", length);
};

const findTargetPipeForCustomerPoint = (
  pipes: Pipe[],
  snapPoint: [number, number],
): Pipe | null => {
  let closestPipe: Pipe | null = null;
  let minDistance = Number.MAX_VALUE;

  const customerSnapPoint = point(snapPoint);

  for (const pipe of pipes) {
    const pipeLineString = lineString(pipe.coordinates);
    const nearestPoint = findNearestPointOnLine(
      pipeLineString,
      customerSnapPoint,
    );

    if (nearestPoint.distance !== null && nearestPoint.distance < minDistance) {
      minDistance = nearestPoint.distance;
      closestPipe = pipe;
    }
  }

  return closestPipe;
};

const reconnectCustomerPointToPipe = (
  customerPoint: CustomerPoint,
  targetPipe: Pipe,
  assets: Map<string, any>,
): CustomerPoint | null => {
  const [startNodeId, endNodeId] = targetPipe.connections;
  const startNode = assets.get(startNodeId);
  const endNode = assets.get(endNodeId);

  if (!startNode || startNode.isLink || !endNode || endNode.isLink) {
    return null;
  }

  const startNodeData = {
    id: startNodeId,
    type: startNode.type,
    coordinates: startNode.coordinates,
  };
  const endNodeData = {
    id: endNodeId,
    type: endNode.type,
    coordinates: endNode.coordinates,
  };

  const targetJunctionId = findJunctionForCustomerPoint(
    startNodeData,
    endNodeData,
    customerPoint.connection!.snapPoint,
  );

  if (!targetJunctionId) {
    return customerPoint.copyDisconnected();
  }

  const reconnectedPoint = customerPoint.copyDisconnected();
  reconnectedPoint.connect({
    pipeId: targetPipe.id,
    snapPoint: customerPoint.connection!.snapPoint,
    junctionId: targetJunctionId,
  });

  return reconnectedPoint;
};
