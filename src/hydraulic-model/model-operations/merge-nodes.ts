import { AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { CustomerPoints } from "../customer-points";
import { Pipe } from "../asset-types/pipe";
import {
  updateLinkConnection,
  reassignCustomerPointsForPipe,
} from "./replace-node";

type InputData = {
  sourceNodeId: AssetId;
  targetNodeId: AssetId;
};

const determineWinner = (
  sourceNode: NodeAsset,
  targetNode: NodeAsset,
): { winnerNode: NodeAsset; loserNode: NodeAsset } => {
  const sourceType = sourceNode.type;
  const targetType = targetNode.type;

  const targetHasPriority =
    (targetType === "reservoir" || targetType === "tank") &&
    sourceType === "junction";

  if (targetHasPriority) {
    return { winnerNode: targetNode, loserNode: sourceNode };
  }

  return { winnerNode: sourceNode, loserNode: targetNode };
};

export const mergeNodes: ModelOperation<InputData> = (
  hydraulicModel,
  { sourceNodeId, targetNodeId },
) => {
  const { assets, topology, customerPointsLookup } = hydraulicModel;

  const sourceNode = assets.get(sourceNodeId) as NodeAsset;
  const targetNode = assets.get(targetNodeId) as NodeAsset;

  if (!sourceNode || !isNodeAsset(sourceNode)) {
    throw new Error(`Invalid source node ID: ${sourceNodeId}`);
  }

  if (!targetNode || !isNodeAsset(targetNode)) {
    throw new Error(`Invalid target node ID: ${targetNodeId}`);
  }

  const { winnerNode, loserNode } = determineWinner(sourceNode, targetNode);
  const winnerNodeId = winnerNode.id;
  const loserNodeId = loserNode.id;

  const winnerNodeCopy = winnerNode.copy();
  winnerNodeCopy.setCoordinates(targetNode.coordinates);
  winnerNodeCopy.setElevation(targetNode.elevation);

  const winnerConnectedLinkIds = topology.getLinks(winnerNodeId);
  const loserConnectedLinkIds = topology.getLinks(loserNodeId);

  const updatedLinks: LinkAsset[] = [];
  const updatedCustomerPoints = new CustomerPoints();

  for (const linkId of winnerConnectedLinkIds) {
    const link = assets.get(linkId) as LinkAsset;
    const linkCopy = link.copy();

    const coordinates = linkCopy.coordinates;
    const newCoordinates = [...coordinates];

    if (linkCopy.connections[0] === winnerNodeId) {
      newCoordinates[0] = targetNode.coordinates;
    }
    if (
      linkCopy.connections[linkCopy.connections.length - 1] === winnerNodeId
    ) {
      newCoordinates[newCoordinates.length - 1] = targetNode.coordinates;
    }

    linkCopy.setCoordinates(newCoordinates);

    updatedLinks.push(linkCopy);

    if (linkCopy.type === "pipe") {
      const pipeCopy = linkCopy as Pipe;
      reassignCustomerPointsForPipe(
        pipeCopy,
        winnerNodeCopy,
        assets,
        customerPointsLookup,
        updatedCustomerPoints,
      );
    }
  }

  for (const linkId of loserConnectedLinkIds) {
    const link = assets.get(linkId) as LinkAsset;
    const linkCopy = link.copy();

    updateLinkConnection(linkCopy, loserNodeId, winnerNodeCopy.id);

    const coordinates = linkCopy.coordinates;
    const newCoordinates = [...coordinates];

    if (linkCopy.connections[0] === winnerNodeId) {
      newCoordinates[0] = targetNode.coordinates;
    }
    if (
      linkCopy.connections[linkCopy.connections.length - 1] === winnerNodeId
    ) {
      newCoordinates[newCoordinates.length - 1] = targetNode.coordinates;
    }

    linkCopy.setCoordinates(newCoordinates);

    updatedLinks.push(linkCopy);

    if (linkCopy.type === "pipe") {
      const pipeCopy = linkCopy as Pipe;
      reassignCustomerPointsForPipe(
        pipeCopy,
        winnerNodeCopy,
        assets,
        customerPointsLookup,
        updatedCustomerPoints,
      );
    }
  }

  return {
    note: `Merge ${loserNode.type} into ${winnerNode.type}`,
    putAssets: [winnerNodeCopy, ...updatedLinks],
    deleteAssets: [loserNodeId],
    putCustomerPoints:
      updatedCustomerPoints.size > 0
        ? [...updatedCustomerPoints.values()]
        : undefined,
  };
};

const isNodeAsset = (asset: unknown): asset is NodeAsset => {
  if (!asset || typeof asset !== "object") return false;
  const type = (asset as { type?: string }).type;
  return type === "junction" || type === "reservoir" || type === "tank";
};
