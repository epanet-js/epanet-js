import { NodeAsset, AssetId } from "../asset-types";
import { Pipe } from "../asset-types/pipe";
import { ModelOperation } from "../model-operation";
import { LabelManager } from "../label-manager";
import { Position } from "src/types";
import { HydraulicModel } from "../hydraulic-model";
import { AssetFactory } from "../factories/asset-factory";
import { splitPipe } from "./split-pipe";
import { Unit } from "src/quantity";

type NodeType = "junction" | "reservoir" | "tank";

type InputData = {
  nodeType: NodeType;
  coordinates: Position;
  elevation?: number;
  pipeIdToSplit?: AssetId;
  lengthUnit: Unit;
  assetFactory: AssetFactory;
  labelManager: LabelManager;
};

export const addNode: ModelOperation<InputData> = (
  hydraulicModel,
  {
    nodeType,
    coordinates,
    elevation = 0,
    pipeIdToSplit,
    lengthUnit,
    assetFactory,
    labelManager,
  },
) => {
  const isActive = getInheritedActiveTopologyStatus(
    hydraulicModel,
    pipeIdToSplit,
  );

  const node = createNode(
    assetFactory,
    nodeType,
    coordinates,
    elevation,
    isActive,
  );
  addMissingLabel(labelManager, node);

  if (pipeIdToSplit) {
    return addNodeWithPipeSplitting(
      hydraulicModel,
      node,
      pipeIdToSplit,
      lengthUnit,
      assetFactory,
      labelManager,
    );
  }

  return {
    note: `Add ${nodeType}`,
    putAssets: [node],
  };
};

const createNode = (
  assetFactory: AssetFactory,
  nodeType: NodeType,
  coordinates: Position,
  elevation: number,
  isActive: boolean,
): NodeAsset => {
  switch (nodeType) {
    case "junction":
      return assetFactory.createJunction({
        coordinates,
        elevation,
        isActive,
      });
    case "reservoir":
      return assetFactory.createReservoir({
        coordinates,
        elevation,
        isActive,
      });
    case "tank":
      return assetFactory.createTank({
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
  lengthUnit: Unit,
  assetFactory: AssetFactory,
  labelManager: LabelManager,
) => {
  const pipe = hydraulicModel.assets.get(pipeIdToSplit) as Pipe;
  if (!pipe || pipe.type !== "pipe") {
    throw new Error(`Invalid pipe ID: ${pipeIdToSplit}`);
  }

  const splitResult = splitPipe(hydraulicModel, {
    pipe,
    splits: [node],
    lengthUnit,
    assetFactory,
    labelManager,
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

const addMissingLabel = (labelManager: LabelManager, node: NodeAsset) => {
  if (node.label === "") {
    node.setProperty("label", labelManager.generateFor(node.type, node.id));
  }
};
