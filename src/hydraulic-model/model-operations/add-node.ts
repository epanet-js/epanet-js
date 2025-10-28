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
  enableVertexSnap?: boolean;
};

export const addNode: ModelOperation<InputData> = (
  hydraulicModel,
  {
    nodeType,
    coordinates,
    elevation = 0,
    pipeIdToSplit,
    enableVertexSnap = false,
  },
) => {
  const node = createNode(hydraulicModel, nodeType, coordinates, elevation);
  addMissingLabel(hydraulicModel.labelManager, node);

  if (pipeIdToSplit) {
    return addNodeWithPipeSplitting(
      hydraulicModel,
      node,
      pipeIdToSplit,
      enableVertexSnap,
    );
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
  enableVertexSnap: boolean,
) => {
  const pipe = hydraulicModel.assets.get(pipeIdToSplit) as Pipe;
  if (!pipe || pipe.type !== "pipe") {
    throw new Error(`Invalid pipe ID: ${pipeIdToSplit}`);
  }

  const splitResult = splitPipe(hydraulicModel, {
    pipe,
    splits: [node],
    enableVertexSnap,
  });

  return {
    note: `Add ${node.type} and split pipe`,
    putAssets: [node, ...splitResult.putAssets!],
    putCustomerPoints: splitResult.putCustomerPoints,
    deleteAssets: splitResult.deleteAssets!,
  };
};

const addMissingLabel = (labelGenerator: LabelGenerator, node: NodeAsset) => {
  if (node.label === "") {
    node.setProperty("label", labelGenerator.generateFor(node.type, node.id));
  }
};
