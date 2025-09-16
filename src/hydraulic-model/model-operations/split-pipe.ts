import { NodeAsset } from "../asset-types";
import { Pipe, PipeProperties } from "../asset-types/pipe";
import { ModelOperation } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { CustomerPoint } from "../customer-points";
import { findJunctionForCustomerPoint } from "../utilities/junction-assignment";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "src/lib/geometry";
import measureLength from "@turf/length";

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

  const tempAssets = new Map(hydraulicModel.assets);
  for (const splitNode of splits) {
    tempAssets.set(splitNode.id, splitNode);
  }

  const connectedCustomerPoints =
    hydraulicModel.customerPointsLookup.getCustomerPoints(pipe.id);
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

    const [pipe1, pipe2] = splitPipeAtPointSimple(
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

const splitPipeAtPointSimple = (
  hydraulicModel: HydraulicModel,
  pipe: Pipe,
  split: NodeAsset,
): [Pipe, Pipe] => {
  const splitPoint = point(split.coordinates);

  const originalCoords = pipe.coordinates;
  const [originalStartNodeId, originalEndNodeId] = pipe.connections;

  let splitIndex = -1;
  let minDistance = Number.MAX_VALUE;

  for (let i = 0; i < originalCoords.length - 1; i++) {
    const segmentLine = lineString([originalCoords[i], originalCoords[i + 1]]);
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
    splitIndex = Math.floor((originalCoords.length - 1) / 2);
  }

  const coords1 = originalCoords.slice(0, splitIndex + 1);
  coords1.push(split.coordinates);

  const coords2 = [split.coordinates];
  coords2.push(...originalCoords.slice(splitIndex + 1));

  const pipe1 = hydraulicModel.assetBuilder.buildPipe({
    label: pipe.label,
    coordinates: coords1,
    connections: [originalStartNodeId, split.id],
  });

  const pipe2 = hydraulicModel.assetBuilder.buildPipe({
    label: pipe.label,
    coordinates: coords2,
    connections: [split.id, originalEndNodeId],
  });

  copyPipeProperties(pipe, pipe1);
  copyPipeProperties(pipe, pipe2);
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
    return null;
  }

  const reconnectedPoint = customerPoint.copyDisconnected();
  reconnectedPoint.connect({
    pipeId: targetPipe.id,
    snapPoint: customerPoint.connection!.snapPoint,
    junctionId: targetJunctionId,
  });

  return reconnectedPoint;
};
