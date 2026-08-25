import {
  NodeAsset,
  AssetId,
  Pipe,
  LabelManager,
  AssetFactory,
} from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { Position } from "src/types";
import { HydraulicModel } from "../hydraulic-model";
import { splitPipe } from "./split-pipe";
import { Unit } from "@epanet-js/quantity";

type NodeType = "junction" | "reservoir" | "tank";

type InputData = {
  nodeType: NodeType;
  coordinates: Position;
  elevation?: number | null;
  pipeIdsToSplit?: AssetId[];
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
    pipeIdsToSplit,
    lengthUnit,
    assetFactory,
    labelManager,
  },
) => {
  // Deduplicated: splitting the same pipe twice would run two independent
  // splits over the same base pipe, emitting duplicate segments that all
  // connect to the new node.
  const pipeIds = Array.from(new Set(pipeIdsToSplit ?? []));

  const isActive = getInheritedActiveTopologyStatus(hydraulicModel, pipeIds);

  const node = createNode(
    assetFactory,
    nodeType,
    coordinates,
    elevation,
    isActive,
  );
  addMissingLabel(labelManager, node);

  if (pipeIds.length > 0) {
    return addNodeWithPipeSplitting(
      hydraulicModel,
      node,
      pipeIds,
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
  elevation: number | null,
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
  pipeIdsToSplit: AssetId[],
  lengthUnit: Unit,
  assetFactory: AssetFactory,
  labelManager: LabelManager,
) => {
  const splitResults = pipeIdsToSplit.map((pipeId) => {
    const pipe = hydraulicModel.assets.get(pipeId) as Pipe;
    if (!pipe || pipe.type !== "pipe") {
      throw new Error(`Invalid pipe ID: ${pipeId}`);
    }

    return splitPipe(hydraulicModel, {
      pipe,
      splits: [node],
      lengthUnit,
      assetFactory,
      labelManager,
    });
  });

  const customerPoints = splitResults.flatMap(
    (result) => result.putCustomerPoints ?? [],
  );

  return {
    note: `Add ${node.type} and split pipe`,
    putAssets: [node, ...splitResults.flatMap((result) => result.putAssets!)],
    putCustomerPoints: customerPoints.length > 0 ? customerPoints : undefined,
    deleteAssets: splitResults.flatMap((result) => result.deleteAssets!),
  };
};

const getInheritedActiveTopologyStatus = (
  hydraulicModel: HydraulicModel,
  pipeIdsToSplit: AssetId[],
): boolean => {
  if (pipeIdsToSplit.length === 0) return true;

  return pipeIdsToSplit.some((pipeId) => {
    const pipe = hydraulicModel.assets.get(pipeId) as Pipe;
    if (!pipe || pipe.type !== "pipe") {
      return true;
    }
    return pipe.feature.properties.isActive;
  });
};

const addMissingLabel = (labelManager: LabelManager, node: NodeAsset) => {
  if (node.label === "") {
    node.setProperty("label", labelManager.generateFor(node.type, node.id));
  }
};
