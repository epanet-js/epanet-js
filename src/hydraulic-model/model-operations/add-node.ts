import { NodeAsset, LinkAsset, AssetId } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { LabelGenerator, LabelManager } from "../label-manager";
import { Position } from "src/types";
import { HydraulicModel } from "../hydraulic-model";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "src/lib/geometry";
import measureLength from "@turf/length";

type NodeType = "junction" | "reservoir" | "tank";

type InputData = {
  nodeType: NodeType;
  coordinates: Position;
  elevation?: number;
  pipeIdToSplit?: AssetId;
};

export const addNode: ModelOperation<InputData> = (
  hydraulicModel,
  { nodeType, coordinates, elevation = 0, pipeIdToSplit },
) => {
  const node = createNode(hydraulicModel, nodeType, coordinates, elevation);
  addMissingLabel(hydraulicModel.labelManager, node);

  if (pipeIdToSplit) {
    return addNodeWithPipeSplitting(hydraulicModel, node, pipeIdToSplit);
  }

  return {
    note: `Add ${nodeType}`,
    putAssets: [node],
  };
};

const createNode = (
  hydraulicModel: HydraulicModel,
  nodeType: NodeType,
  coordinates: Position,
  elevation: number,
): NodeAsset => {
  const { assetBuilder } = hydraulicModel;

  switch (nodeType) {
    case "junction":
      return assetBuilder.buildJunction({
        coordinates,
        elevation,
      });
    case "reservoir":
      return assetBuilder.buildReservoir({
        coordinates,
        elevation,
      });
    case "tank":
      return assetBuilder.buildTank({
        coordinates,
        elevation,
      });
    default:
      throw new Error(`Unsupported node type: ${nodeType as string}`);
  }
};

const addNodeWithPipeSplitting = (
  hydraulicModel: HydraulicModel,
  node: NodeAsset,
  pipeIdToSplit: AssetId,
) => {
  const pipe = hydraulicModel.assets.get(pipeIdToSplit) as LinkAsset;
  if (!pipe || !pipe.isLink || pipe.type !== "pipe") {
    throw new Error(`Invalid pipe ID: ${pipeIdToSplit}`);
  }

  const splitPoint = point(node.coordinates);
  const pipeLineString = lineString(pipe.coordinates);
  const nearestPoint = findNearestPointOnLine(pipeLineString, splitPoint);
  const splitCoordinates = nearestPoint.coordinates;

  const { pipe1, pipe2 } = splitPipeAtPoint(
    hydraulicModel,
    pipe,
    splitCoordinates,
    node.id,
  );

  return {
    note: `Add ${node.type} and split pipe`,
    putAssets: [node, pipe1, pipe2],
    deleteAssets: [pipe.id],
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

  const baseLabel = originalPipe.label;
  const label1 = generateUniqueLabel(
    hydraulicModel.labelManager,
    baseLabel,
    "_1",
  );
  const label2 = generateUniqueLabel(
    hydraulicModel.labelManager,
    baseLabel,
    "_2",
  );

  const [originalStartNodeId, originalEndNodeId] = originalPipe.connections;

  const pipe1 = hydraulicModel.assetBuilder.buildPipe({
    label: label1,
    coordinates: coordinates1,
    connections: [originalStartNodeId, newNodeId],
  });

  const pipe2 = hydraulicModel.assetBuilder.buildPipe({
    label: label2,
    coordinates: coordinates2,
    connections: [newNodeId, originalEndNodeId],
  });

  copyPipeProperties(originalPipe, pipe1);
  copyPipeProperties(originalPipe, pipe2);

  updatePipeLength(pipe1);
  updatePipeLength(pipe2);

  return { pipe1, pipe2 };
};

const generateUniqueLabel = (
  labelManager: LabelManager,
  baseLabel: string,
  suffix: string,
): string => {
  let candidate = `${baseLabel}${suffix}`;
  let counter = 1;

  while (labelManager.count(candidate) > 0) {
    candidate = `${baseLabel}${suffix}_${counter}`;
    counter++;
  }

  return candidate;
};

const copyPipeProperties = (source: LinkAsset, target: LinkAsset) => {
  const propertiesToCopy = [
    "diameter",
    "roughness",
    "minorloss",
    "status",
    "description",
  ] as const;

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

const addMissingLabel = (labelGenerator: LabelGenerator, node: NodeAsset) => {
  if (node.label === "") {
    node.setProperty("label", labelGenerator.generateFor(node.type, node.id));
  }
};
