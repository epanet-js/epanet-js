import { NodeAsset, AssetId } from "../asset-types";
import { Pipe } from "../asset-types/pipe";
import { ModelOperation } from "../model-operation";
import { LabelGenerator } from "../label-manager";
import { Position } from "src/types";
import { HydraulicModel } from "../hydraulic-model";
import { splitPipe } from "./split-pipe";

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
  const isActive = getInheritedActiveTopologyStatus(
    hydraulicModel,
    pipeIdToSplit,
  );

  const node = createNode(
    hydraulicModel,
    nodeType,
    coordinates,
    elevation,
    isActive,
  );
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
  isActive: boolean,
): NodeAsset => {
  const { assetBuilder } = hydraulicModel;

  switch (nodeType) {
    case "junction":
      return assetBuilder.buildJunction({
        coordinates,
        elevation,
        isActive,
      });
    case "reservoir":
      return assetBuilder.buildReservoir({
        coordinates,
        elevation,
        isActive,
      });
    case "tank":
      return assetBuilder.buildTank({
        coordinates,
        elevation,
        isActive,
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
  const pipe = hydraulicModel.assets.get(pipeIdToSplit) as Pipe;
  if (!pipe || pipe.type !== "pipe") {
    throw new Error(`Invalid pipe ID: ${pipeIdToSplit}`);
  }

  const splitResult = splitPipe(hydraulicModel, {
    pipe,
    splits: [node],
  });

  return {
    note: `Add ${node.type} and split pipe`,
    putAssets: [node, ...splitResult.putAssets!],
    putCustomerPoints: splitResult.putCustomerPoints,
    deleteAssets: splitResult.deleteAssets!,
  };
};

const getInheritedActiveTopologyStatus = (
  hydraulicModel: HydraulicModel,
  pipeIdToSplit?: AssetId,
): boolean => {
  if (!pipeIdToSplit) return true;
  const pipe = hydraulicModel.assets.get(pipeIdToSplit) as Pipe;
  if (!pipe || pipe.type !== "pipe") {
    return true;
  }
  return pipe.feature.properties.isActive;
};

const addMissingLabel = (labelGenerator: LabelGenerator, node: NodeAsset) => {
  if (node.label === "") {
    node.setProperty("label", labelGenerator.generateFor(node.type, node.id));
  }
};
