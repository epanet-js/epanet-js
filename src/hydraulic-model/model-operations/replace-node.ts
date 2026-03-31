import { AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { AssetFactory } from "../factories/asset-factory";
import { CustomerPoints } from "../customer-points";
import { Pipe } from "../asset-types/pipe";
import { Position } from "src/types";
import { updateLinkConnections } from "../mutations/update-link-connections";
import { isNodeAsset } from "../asset-types/type-guards";
import { reassignCustomerPoints } from "../mutations/reassign-customer-points";
import { getJunctionDemands } from "../demands";

type NodeType = "junction" | "reservoir" | "tank";

type InputData = {
  oldNodeId: AssetId;
  newNodeType: NodeType;
  assetFactory: AssetFactory;
};

export const replaceNode: ModelOperation<InputData> = (
  hydraulicModel,
  { oldNodeId, newNodeType, assetFactory },
) => {
  const { assets, topology, customerPointsLookup } = hydraulicModel;

  const oldNode = assets.get(oldNodeId) as NodeAsset;
  if (!oldNode || !isNodeAsset(oldNode)) {
    throw new Error(`Invalid node ID: ${oldNodeId}`);
  }

  const oldCoordinates = oldNode.coordinates;
  const oldElevation = oldNode.elevation;
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

  const putDemands =
    oldNode.type === "junction" && newNodeType !== "junction"
      ? (() => {
          const demands = getJunctionDemands(hydraulicModel.demands, oldNodeId);
          return demands.length > 0
            ? { assignments: [{ junctionId: oldNodeId, demands: [] }] }
            : undefined;
        })()
      : undefined;

  return {
    note: `Replace ${oldNode.type} with ${newNodeType}`,
    putAssets: [newNode, ...updatedLinks],
    deleteAssets: [oldNodeId],
    putCustomerPoints:
      updatedCustomerPoints.size > 0
        ? [...updatedCustomerPoints.values()]
        : undefined,
    ...(putDemands && { putDemands }),
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
