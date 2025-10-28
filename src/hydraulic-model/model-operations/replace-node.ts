import { AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { CustomerPoint, CustomerPoints } from "../customer-points";
import { Pipe } from "../asset-types/pipe";
import { findJunctionForCustomerPoint } from "../utilities/junction-assignment";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "src/lib/geometry";
import { Position } from "src/types";

type NodeType = "junction" | "reservoir" | "tank";

export const findNearestSnappingPoint = (
  pipe: Pipe,
  customerPoint: CustomerPoint,
): Position => {
  const pipeLineString = lineString(pipe.coordinates);
  const customerPointGeometry = point(customerPoint.coordinates);

  const result = findNearestPointOnLine(pipeLineString, customerPointGeometry);
  return result.coordinates;
};

export const updateLinkConnection = (
  linkCopy: LinkAsset,
  oldNodeId: AssetId,
  newNodeId: AssetId,
): void => {
  const [startNodeId, endNodeId] = linkCopy.connections;
  if (startNodeId === oldNodeId) {
    linkCopy.setConnections(newNodeId, endNodeId);
  } else if (endNodeId === oldNodeId) {
    linkCopy.setConnections(startNodeId, newNodeId);
  }
};

export const reassignCustomerPointsForPipe = (
  pipeCopy: Pipe,
  newNode: NodeAsset,
  assets: HydraulicModel["assets"],
  customerPointsLookup: HydraulicModel["customerPointsLookup"],
  updatedCustomerPoints: CustomerPoints,
): void => {
  const connectedCustomerPoints = customerPointsLookup.getCustomerPoints(
    pipeCopy.id,
  );

  for (const customerPoint of connectedCustomerPoints) {
    if (!updatedCustomerPoints.has(customerPoint.id)) {
      const [startNode, endNode] = pipeCopy.connections.map(
        (connectedNodeId) =>
          connectedNodeId === newNode.id
            ? newNode
            : (assets.get(connectedNodeId) as NodeAsset),
      );

      const customerPointCopy = customerPoint.copyDisconnected();
      const snapPoint = findNearestSnappingPoint(pipeCopy, customerPointCopy);
      const junctionId = findJunctionForCustomerPoint(
        startNode,
        endNode,
        snapPoint,
      );

      if (junctionId) {
        customerPointCopy.connect({
          pipeId: pipeCopy.id,
          snapPoint,
          junctionId,
        });
      }

      updatedCustomerPoints.set(customerPointCopy.id, customerPointCopy);
    }
  }
};

type InputData = {
  oldNodeId: AssetId;
  newNodeType: NodeType;
};

export const replaceNode: ModelOperation<InputData> = (
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

  const newNode = createNode(
    assetBuilder,
    newNodeType,
    oldCoordinates,
    oldElevation,
  );

  const newLabel = labelManager.generateFor(newNodeType, newNode.id);
  newNode.setProperty("label", newLabel);

  const connectedLinkIds = topology.getLinks(oldNodeId);
  const updatedLinks: LinkAsset[] = [];
  const updatedCustomerPoints = new CustomerPoints();

  for (const linkId of connectedLinkIds) {
    const link = assets.get(linkId) as LinkAsset;
    const linkCopy = link.copy();

    updateLinkConnection(linkCopy, oldNodeId, newNode.id);

    updatedLinks.push(linkCopy);

    if (linkCopy.type === "pipe") {
      const pipeCopy = linkCopy as Pipe;
      reassignCustomerPointsForPipe(
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

const isNodeAsset = (asset: unknown): asset is NodeAsset => {
  if (!asset || typeof asset !== "object") return false;
  const type = (asset as { type?: string }).type;
  return type === "junction" || type === "reservoir" || type === "tank";
};

const createNode = (
  assetBuilder: HydraulicModel["assetBuilder"],
  nodeType: NodeType,
  coordinates: Position,
  elevation: number,
): NodeAsset => {
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
