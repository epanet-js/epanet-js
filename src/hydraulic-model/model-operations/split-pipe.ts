import { LinkAsset, AssetId } from "../asset-types";
import { PipeProperties } from "../asset-types/pipe";
import { ModelOperation } from "../model-operation";
import { Position } from "src/types";
import { HydraulicModel } from "../hydraulic-model";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "src/lib/geometry";
import measureLength from "@turf/length";
import { LabelManager } from "../label-manager";

type CopyablePipeProperties = Pick<
  PipeProperties,
  "diameter" | "roughness" | "minorLoss" | "initialStatus"
>;
type CopyablePipePropertyKeys = keyof CopyablePipeProperties;

type SplitPipeInput = {
  pipeId: AssetId;
  splits: Array<{ nodeId: AssetId; position: Position }>;
};

export const splitPipe: ModelOperation<SplitPipeInput> = (
  hydraulicModel,
  { pipeId, splits },
) => {
  const originalPipe = hydraulicModel.assets.get(pipeId) as LinkAsset;
  if (!originalPipe || !originalPipe.isLink || originalPipe.type !== "pipe") {
    throw new Error(`Invalid pipe ID: ${pipeId}`);
  }

  if (splits.length === 0) {
    throw new Error("At least one split is required");
  }

  const newPipes = splitPipeAtMultiplePoints(
    hydraulicModel,
    originalPipe,
    splits,
  );

  return {
    note: `Split pipe`,
    putAssets: newPipes,
    deleteAssets: [originalPipe.id],
  };
};

const splitPipeAtMultiplePoints = (
  hydraulicModel: HydraulicModel,
  originalPipe: LinkAsset,
  splits: Array<{ nodeId: AssetId; position: Position }>,
): LinkAsset[] => {
  const originalCoordinates = originalPipe.coordinates;
  const [originalStartNodeId, originalEndNodeId] = originalPipe.connections;
  const originalLabel = originalPipe.label;

  const snappedSplits = splits.map((split) => ({
    ...split,
    position: snapPositionToPipe(originalCoordinates, split.position),
  }));

  const splitsWithDistance = snappedSplits.map((split) => ({
    ...split,
    distance: calculateSplitDistance(originalCoordinates, split.position),
  }));

  const sortedSplits = splitsWithDistance.sort(
    (a, b) => a.distance - b.distance,
  );

  const segmentCoordinates = buildSegmentCoordinates(
    originalCoordinates,
    sortedSplits,
  );
  const segmentConnections = buildSegmentConnections(
    originalStartNodeId,
    originalEndNodeId,
    sortedSplits,
  );

  const newPipes: LinkAsset[] = [];
  const labels = generateLabels(
    hydraulicModel.labelManager,
    originalLabel,
    segmentCoordinates.length,
  );

  for (let i = 0; i < segmentCoordinates.length; i++) {
    const pipe = hydraulicModel.assetBuilder.buildPipe({
      label: labels[i],
      coordinates: segmentCoordinates[i],
      connections: segmentConnections[i],
    });

    copyPipeProperties(originalPipe, pipe);
    updatePipeLength(pipe);

    newPipes.push(pipe);
  }

  return newPipes;
};

const generateLabels = (
  labelManager: LabelManager,
  originalLabel: string,
  count: number,
) => {
  const labels: string[] = [originalLabel];

  for (let i = 1; i < count; i++) {
    const lastLabel = labels[labels.length - 1];
    const nextLabel = labelManager.generateNextLabel(lastLabel);
    labels.push(nextLabel);
  }
  return labels;
};

const snapPositionToPipe = (
  pipeCoordinates: Position[],
  position: Position,
): Position => {
  const splitPoint = point(position);
  let bestSnappedPosition = position;
  let minDistance = Number.MAX_VALUE;

  for (let i = 0; i < pipeCoordinates.length - 1; i++) {
    const segmentStart = pipeCoordinates[i];
    const segmentEnd = pipeCoordinates[i + 1];
    const segmentLine = lineString([segmentStart, segmentEnd]);
    const nearestPoint = findNearestPointOnLine(segmentLine, splitPoint);

    if (nearestPoint.distance !== null && nearestPoint.distance < minDistance) {
      minDistance = nearestPoint.distance;
      bestSnappedPosition = nearestPoint.coordinates;
    }
  }

  if (minDistance < 0.001) {
    return bestSnappedPosition;
  }

  return position;
};

const buildSegmentCoordinates = (
  originalCoordinates: Position[],
  splits: Array<{ nodeId: AssetId; position: Position }>,
): Position[][] => {
  const allCriticalPoints = [
    originalCoordinates[0],
    ...splits.map((split) => split.position),
    originalCoordinates[originalCoordinates.length - 1],
  ];

  const segments: Position[][] = [];

  for (let i = 0; i < allCriticalPoints.length - 1; i++) {
    const segmentStart = allCriticalPoints[i];
    const segmentEnd = allCriticalPoints[i + 1];

    const segmentCoordinates = [segmentStart];

    if (originalCoordinates.length > 2) {
      for (let j = 1; j < originalCoordinates.length - 1; j++) {
        const coord = originalCoordinates[j];
        if (
          isCoordinateBetweenPoints(
            coord,
            segmentStart,
            segmentEnd,
            originalCoordinates,
          )
        ) {
          segmentCoordinates.push(coord);
        }
      }
    }

    segmentCoordinates.push(segmentEnd);
    segments.push(segmentCoordinates);
  }

  return segments;
};

const isCoordinateBetweenPoints = (
  coord: Position,
  start: Position,
  end: Position,
  originalCoordinates: Position[],
): boolean => {
  const startIndex = originalCoordinates.findIndex(
    (c) =>
      Math.abs(c[0] - start[0]) < 0.0001 && Math.abs(c[1] - start[1]) < 0.0001,
  );
  const endIndex = originalCoordinates.findIndex(
    (c) => Math.abs(c[0] - end[0]) < 0.0001 && Math.abs(c[1] - end[1]) < 0.0001,
  );
  const coordIndex = originalCoordinates.findIndex(
    (c) =>
      Math.abs(c[0] - coord[0]) < 0.0001 && Math.abs(c[1] - coord[1]) < 0.0001,
  );

  if (startIndex === -1 || endIndex === -1 || coordIndex === -1) {
    const distanceFromStart = Math.sqrt(
      Math.pow(coord[0] - start[0], 2) + Math.pow(coord[1] - start[1], 2),
    );
    const distanceFromEnd = Math.sqrt(
      Math.pow(coord[0] - end[0], 2) + Math.pow(coord[1] - end[1], 2),
    );
    const segmentLength = Math.sqrt(
      Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2),
    );

    return (
      Math.abs(distanceFromStart + distanceFromEnd - segmentLength) < 0.0001
    );
  }

  return (
    coordIndex > Math.min(startIndex, endIndex) &&
    coordIndex < Math.max(startIndex, endIndex)
  );
};

const calculateSplitDistance = (
  pipeCoordinates: Position[],
  splitPosition: Position,
): number => {
  for (let i = 0; i < pipeCoordinates.length; i++) {
    const coord = pipeCoordinates[i];
    if (
      Math.abs(coord[0] - splitPosition[0]) < 0.0001 &&
      Math.abs(coord[1] - splitPosition[1]) < 0.0001
    ) {
      return calculateDistanceAlongPath(pipeCoordinates, 0, i);
    }
  }

  for (let i = 0; i < pipeCoordinates.length - 1; i++) {
    const coord1 = pipeCoordinates[i];
    const coord2 = pipeCoordinates[i + 1];

    const segmentLine = lineString([coord1, coord2]);
    const nearestPoint = findNearestPointOnLine(
      segmentLine,
      point(splitPosition),
    );

    if (nearestPoint.distance !== null && nearestPoint.distance < 0.001) {
      const distanceToSegmentStart = calculateDistanceAlongPath(
        pipeCoordinates,
        0,
        i,
      );
      const distanceAlongSegment = Math.sqrt(
        Math.pow(nearestPoint.coordinates[0] - coord1[0], 2) +
          Math.pow(nearestPoint.coordinates[1] - coord1[1], 2),
      );
      return distanceToSegmentStart + distanceAlongSegment;
    }
  }

  return 0;
};

const calculateDistanceAlongPath = (
  coordinates: Position[],
  startIndex: number,
  endIndex: number,
): number => {
  let distance = 0;
  for (let i = startIndex; i < endIndex; i++) {
    const coord1 = coordinates[i];
    const coord2 = coordinates[i + 1];
    distance += Math.sqrt(
      Math.pow(coord2[0] - coord1[0], 2) + Math.pow(coord2[1] - coord1[1], 2),
    );
  }
  return distance;
};

const buildSegmentConnections = (
  originalStartNodeId: AssetId,
  originalEndNodeId: AssetId,
  splits: Array<{ nodeId: AssetId; position: Position }>,
): [AssetId, AssetId][] => {
  const allNodeIds = [
    originalStartNodeId,
    ...splits.map((split) => split.nodeId),
    originalEndNodeId,
  ];

  const connections: [AssetId, AssetId][] = [];

  for (let i = 0; i < allNodeIds.length - 1; i++) {
    connections.push([allNodeIds[i], allNodeIds[i + 1]]);
  }

  return connections;
};

const copyPipeProperties = (source: LinkAsset, target: LinkAsset) => {
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

const updatePipeLength = (pipe: LinkAsset) => {
  const length = measureLength(pipe.feature, { units: "meters" });
  pipe.setProperty("length", length);
};
