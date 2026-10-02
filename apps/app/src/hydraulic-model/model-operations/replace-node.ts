import {
  AssetId,
  LinkAsset,
  NodeAsset,
  AssetFactory,
  CustomerPoints,
  Pipe,
  isNodeAsset,
} from "@epanet-js/hydraulic-model";
import {
  DemandAssignment,
  ModelOperation,
  ModelOperationDeprecated,
} from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { Position } from "src/types";
import { updateLinkConnections } from "../mutations/update-link-connections";
import { reassignCustomerPoints } from "../mutations/reassign-customer-points";
import { getJunctionDemands } from "@epanet-js/hydraulic-model";
import {
  changeSet,
  dropAssets,
  putAssets,
  putCustomerPoints,
  setDemands,
} from "../change-sets";

type NodeType = "junction" | "reservoir" | "tank";

type InputData = {
  oldNodeId: AssetId;
  newNodeType: NodeType;
  assetFactory: AssetFactory;
  elevation?: number | null;
};

export const replaceNode: ModelOperation<InputData> = (
  hydraulicModel,
  data,
) => {
  const { note, oldNodeId, newNode, updatedLinks, customerPoints, demands } =
    planReplacement(hydraulicModel, data);

  return changeSet(hydraulicModel, note, [
    dropAssets(oldNodeId),
    putAssets([newNode, ...updatedLinks]),
    putCustomerPoints(customerPoints),
    setDemands(demands),
  ]);
};

export const replaceNodeDeprecated: ModelOperationDeprecated<InputData> = (
  hydraulicModel,
  data,
) => {
  const { note, oldNodeId, newNode, updatedLinks, customerPoints, demands } =
    planReplacement(hydraulicModel, data);

  return {
    note,
    putAssets: [newNode, ...updatedLinks],
    deleteAssets: [oldNodeId],
    putCustomerPoints: customerPoints.length > 0 ? customerPoints : undefined,
    ...(demands.length > 0 && { putDemands: { assignments: demands } }),
  };
};

const planReplacement = (
  hydraulicModel: HydraulicModel,
  { oldNodeId, newNodeType, assetFactory, elevation }: InputData,
) => {
  const { assets, topology, customerPointsLookup } = hydraulicModel;

  const oldNode = assets.get(oldNodeId) as NodeAsset;
  if (!oldNode || !isNodeAsset(oldNode)) {
    throw new Error(`Invalid node ID: ${oldNodeId}`);
  }

  const oldCoordinates = oldNode.coordinates;
  const oldElevation = oldNode.elevation ?? elevation;
  const oldIsActive = oldNode.isActive;

  const newNode = createNode(
    assetFactory,
    newNodeType,
    oldCoordinates,
    oldElevation,
    oldIsActive,
  );

  const connectedLinkIds = topology.getLinks(oldNodeId);
  const updatedLinks: LinkAsset[] = [];
  const updatedCustomerPoints = new CustomerPoints();

  for (const linkId of connectedLinkIds) {
    const link = assets.get(linkId) as LinkAsset;
    const linkCopy = link.copy();

    updateLinkConnections(linkCopy, oldNodeId, newNode.id);

    updatedLinks.push(linkCopy);

    if (linkCopy.type === "pipe") {
      const pipeCopy = linkCopy as Pipe;
      reassignCustomerPoints(
        pipeCopy,
        newNode,
        assets,
        customerPointsLookup,
        updatedCustomerPoints,
      );
    }
  }

  const demands: DemandAssignment[] =
    oldNode.type === "junction" &&
    newNodeType !== "junction" &&
    getJunctionDemands(hydraulicModel.demands, oldNodeId).length > 0
      ? [{ junctionId: oldNodeId, demands: [] }]
      : [];

  return {
    note: "replaceNode" as const,
    oldNodeId,
    newNode,
    updatedLinks,
    customerPoints: [...updatedCustomerPoints.values()],
    demands,
  };
};

const createNode = (
  assetFactory: AssetFactory,
  nodeType: NodeType,
  coordinates: Position,
  elevation: number | null | undefined,
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
