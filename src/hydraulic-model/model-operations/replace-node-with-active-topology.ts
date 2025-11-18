import { AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { CustomerPoints } from "../customer-points";
import { Pipe } from "../asset-types/pipe";
import { Position } from "src/types";
import { updateLinkConnections } from "../mutations/update-link-connections";
import { isNodeAsset } from "../asset-types/type-guards";
import { reassignCustomerPoints } from "../mutations/reassign-customer-points";

type NodeType = "junction" | "reservoir" | "tank";

type InputData = {
  oldNodeId: AssetId;
  newNodeType: NodeType;
};

export const replaceNodeWithActiveTopology: ModelOperation<InputData> = (
  hydraulicModel,
  { oldNodeId, newNodeType },
) => {
  const { assets, topology, labelManager, assetBuilder, customerPointsLookup } =
    hydraulicModel;

  const oldNode = assets.get(oldNodeId) as NodeAsset;
  if (!oldNode || !isNodeAsset(oldNode)) {
    throw new Error(`Invalid node ID: ${oldNodeId}`);
  }

  const oldCoordinates = oldNode.coordinates;
  const oldElevation = oldNode.elevation;
  const oldIsActive = oldNode.isActive;

  const newNode = createNode(
    assetBuilder,
    newNodeType,
    oldCoordinates,
    oldElevation,
    oldIsActive,
  );

  const newLabel = labelManager.generateFor(newNodeType, newNode.id);
  newNode.setProperty("label", newLabel);

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

  return {
    note: `Replace ${oldNode.type} with ${newNodeType}`,
    putAssets: [newNode, ...updatedLinks],
    deleteAssets: [oldNodeId],
    putCustomerPoints:
      updatedCustomerPoints.size > 0
        ? [...updatedCustomerPoints.values()]
        : undefined,
  };
};

const createNode = (
  assetBuilder: HydraulicModel["assetBuilder"],
  nodeType: NodeType,
  coordinates: Position,
  elevation: number,
  isActive: boolean,
): NodeAsset => {
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
