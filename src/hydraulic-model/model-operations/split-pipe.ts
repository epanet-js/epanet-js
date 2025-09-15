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

  const newPipes = splitPipeIteratively(hydraulicModel, originalPipe, splits);

  return {
    note: `Split pipe`,
    putAssets: newPipes,
    deleteAssets: [originalPipe.id],
  };
};

const findPipeContainingSplit = (
  pipes: LinkAsset[],
  split: { nodeId: AssetId; position: Position },
): number => {
  let bestPipeIndex = 0;
  let minDistance = Number.MAX_VALUE;

  for (let i = 0; i < pipes.length; i++) {
    const pipe = pipes[i];
    const line = lineString(pipe.coordinates);
    const splitPoint = point(split.position);

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
  originalPipe: LinkAsset,
  splits: Array<{ nodeId: AssetId; position: Position }>,
): LinkAsset[] => {
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
  pipes: LinkAsset[],
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
  pipe: LinkAsset,
  split: { nodeId: AssetId; position: Position },
): [LinkAsset, LinkAsset] => {
  const splitPoint = point(split.position);

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
  coords1.push(split.position);

  const coords2 = [split.position];
  coords2.push(...originalCoords.slice(splitIndex + 1));

  const pipe1 = hydraulicModel.assetBuilder.buildPipe({
    label: pipe.label,
    coordinates: coords1,
    connections: [originalStartNodeId, split.nodeId],
  });

  const pipe2 = hydraulicModel.assetBuilder.buildPipe({
    label: pipe.label,
    coordinates: coords2,
    connections: [split.nodeId, originalEndNodeId],
  });

  copyPipeProperties(pipe, pipe1);
  copyPipeProperties(pipe, pipe2);
  updatePipeLength(pipe1);
  updatePipeLength(pipe2);

  return [pipe1, pipe2];
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
