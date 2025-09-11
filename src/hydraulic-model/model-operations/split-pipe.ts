import { LinkAsset, AssetId } from "../asset-types";
import { PipeProperties } from "../asset-types/pipe";
import { ModelOperation } from "../model-operation";
import { Position } from "src/types";
import { HydraulicModel } from "../hydraulic-model";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "src/lib/geometry";
import measureLength from "@turf/length";

type CopyablePipeProperties = Pick<
  PipeProperties,
  "diameter" | "roughness" | "minorLoss" | "initialStatus"
>;
type CopyablePipePropertyKeys = keyof CopyablePipeProperties;

type SplitPipeInput = {
  pipeIdToSplit: AssetId;
  splitCoordinates: Position;
  newNodeId: AssetId;
};

export const splitPipe: ModelOperation<SplitPipeInput> = (
  hydraulicModel,
  { pipeIdToSplit, splitCoordinates, newNodeId },
) => {
  const originalPipe = hydraulicModel.assets.get(pipeIdToSplit) as LinkAsset;
  if (!originalPipe || !originalPipe.isLink || originalPipe.type !== "pipe") {
    throw new Error(`Invalid pipe ID: ${pipeIdToSplit}`);
  }

  const { pipe1, pipe2 } = splitPipeAtPoint(
    hydraulicModel,
    originalPipe,
    splitCoordinates,
    newNodeId,
  );

  return {
    note: `Split pipe`,
    putAssets: [pipe1, pipe2],
    deleteAssets: [originalPipe.id],
  };
};

const splitPipeAtPoint = (
  hydraulicModel: HydraulicModel,
  originalPipe: LinkAsset,
  splitCoordinates: Position,
  newNodeId: AssetId,
) => {
  const originalCoordinates = originalPipe.coordinates;
  const splitPoint = point(splitCoordinates);

  let segmentIndex = 0;
  let minDistance = Number.MAX_VALUE;

  for (let i = 0; i < originalCoordinates.length - 1; i++) {
    const segmentStart = originalCoordinates[i];
    const segmentEnd = originalCoordinates[i + 1];
    const segmentLine = lineString([segmentStart, segmentEnd]);
    const distanceToSegment =
      findNearestPointOnLine(segmentLine, splitPoint).distance ||
      Number.MAX_VALUE;

    if (distanceToSegment < minDistance) {
      minDistance = distanceToSegment;
      segmentIndex = i;
    }
  }

  const coordinates1 = [
    ...originalCoordinates.slice(0, segmentIndex + 1),
    splitCoordinates,
  ];
  const coordinates2 = [
    splitCoordinates,
    ...originalCoordinates.slice(segmentIndex + 1),
  ];

  const originalLabel = originalPipe.label;
  const newLabel = hydraulicModel.labelManager.generateNextLabel(originalLabel);

  const [originalStartNodeId, originalEndNodeId] = originalPipe.connections;

  const pipe1 = hydraulicModel.assetBuilder.buildPipe({
    label: originalLabel,
    coordinates: coordinates1,
    connections: [originalStartNodeId, newNodeId],
  });

  const pipe2 = hydraulicModel.assetBuilder.buildPipe({
    label: newLabel,
    coordinates: coordinates2,
    connections: [newNodeId, originalEndNodeId],
  });

  copyPipeProperties(originalPipe, pipe1);
  copyPipeProperties(originalPipe, pipe2);

  updatePipeLength(pipe1);
  updatePipeLength(pipe2);

  return { pipe1, pipe2 };
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
