import {
  NodeAsset,
  AssetId,
  Pipe,
  LabelManager,
  AssetFactory,
} from "@epanet-js/hydraulic-model";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { Position } from "src/types";
import { HydraulicModel } from "../hydraulic-model";
import { controlsAfterSplits, splitPipe } from "./split-pipe";
import { Unit } from "@epanet-js/quantity";
import {
  changeSet,
  dropAssets,
  putAssets,
  putCustomerPoints,
  replaceControls,
} from "../change-sets";

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

export const addNode: ModelOperation<InputData> = (hydraulicModel, data) => {
  const { note, node, newPipes, removedPipeIds, customerPoints, controls } =
    planAddition(hydraulicModel, data);

  return changeSet(hydraulicModel, note, [
    dropAssets(removedPipeIds),
    putAssets([node, ...newPipes]),
    putCustomerPoints(customerPoints),
    ...(controls ? [replaceControls(controls)] : []),
  ]);
};

export const addNodeDeprecated: ModelOperationDeprecated<InputData> = (
  hydraulicModel,
  data,
) => {
  const { note, node, newPipes, removedPipeIds, customerPoints, controls } =
    planAddition(hydraulicModel, data);

  if (removedPipeIds.length === 0) {
    return { note, putAssets: [node] };
  }

  return {
    note,
    putAssets: [node, ...newPipes],
    putCustomerPoints: customerPoints.length > 0 ? customerPoints : undefined,
    deleteAssets: removedPipeIds,
    ...(controls && { putControls: controls }),
  };
};

const planAddition = (
  hydraulicModel: HydraulicModel,
  {
    nodeType,
    coordinates,
    elevation = 0,
    pipeIdsToSplit,
    lengthUnit,
    assetFactory,
    labelManager,
  }: InputData,
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

  const splitResults = pipeIds.map((pipeId) => {
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

  return {
    note: "addNode" as const,
    node,
    newPipes: splitResults.flatMap((result) => result.newPipes),
    removedPipeIds: splitResults.map((result) => result.removedPipeId),
    customerPoints: splitResults.flatMap((result) => result.customerPoints),
    controls: controlsAfterSplits(hydraulicModel, splitResults),
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
