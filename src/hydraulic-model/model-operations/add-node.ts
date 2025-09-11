import { NodeAsset, AssetId } from "../asset-types";
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
  const splitResult = splitPipe(hydraulicModel, {
    pipeIdToSplit,
    splitCoordinates: node.coordinates,
    newNodeId: node.id,
  });

  return {
    note: `Add ${node.type} and split pipe`,
    putAssets: [node, ...splitResult.putAssets!],
    deleteAssets: splitResult.deleteAssets!,
  };
};

const addMissingLabel = (labelGenerator: LabelGenerator, node: NodeAsset) => {
  if (node.label === "") {
    node.setProperty("label", labelGenerator.generateFor(node.type, node.id));
  }
};
