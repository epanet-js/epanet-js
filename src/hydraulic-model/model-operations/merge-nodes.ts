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

  const sourceNodeCopy = sourceNode.copy();
  sourceNodeCopy.setCoordinates(targetNode.coordinates);

  const sourceConnectedLinkIds = topology.getLinks(sourceNodeId);
  const targetConnectedLinkIds = topology.getLinks(targetNodeId);

  const updatedLinks: LinkAsset[] = [];
  const updatedCustomerPoints = new CustomerPoints();

  for (const linkId of sourceConnectedLinkIds) {
    const link = assets.get(linkId) as LinkAsset;
    const linkCopy = link.copy();

    const coordinates = linkCopy.coordinates;
    const newCoordinates = [...coordinates];

    if (linkCopy.connections[0] === sourceNodeId) {
      newCoordinates[0] = targetNode.coordinates;
    }
    if (
      linkCopy.connections[linkCopy.connections.length - 1] === sourceNodeId
    ) {
      newCoordinates[newCoordinates.length - 1] = targetNode.coordinates;
    }

    linkCopy.setCoordinates(newCoordinates);

    updatedLinks.push(linkCopy);

    if (linkCopy.type === "pipe") {
      const pipeCopy = linkCopy as Pipe;
      reassignCustomerPointsForPipe(
        pipeCopy,
        sourceNodeCopy,
        assets,
        customerPointsLookup,
        updatedCustomerPoints,
      );
    }
  }

  for (const linkId of targetConnectedLinkIds) {
    const link = assets.get(linkId) as LinkAsset;
    const linkCopy = link.copy();

    updateLinkConnection(linkCopy, targetNodeId, sourceNodeCopy.id);

    updatedLinks.push(linkCopy);

    if (linkCopy.type === "pipe") {
      const pipeCopy = linkCopy as Pipe;
      reassignCustomerPointsForPipe(
        pipeCopy,
        sourceNodeCopy,
        assets,
        customerPointsLookup,
        updatedCustomerPoints,
      );
    }
  }

  return {
    note: `Merge ${sourceNode.type} into ${targetNode.type}`,
    putAssets: [sourceNodeCopy, ...updatedLinks],
    deleteAssets: [targetNodeId],
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
