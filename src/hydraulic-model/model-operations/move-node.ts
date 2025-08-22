import { Position } from "geojson";
import { AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { AssetsMap, getNode } from "../assets-map";
import { ModelOperation } from "../model-operation";
import { CustomerPoint, CustomerPoints } from "../customer-points";
import { Pipe } from "../asset-types/pipe";
import { findJunctionForCustomerPoint } from "../utilities/junction-assignment";
import turfNearestPointOnLine from "@turf/nearest-point-on-line";
import { lineString, point } from "@turf/helpers";

type InputData = {
  nodeId: AssetId;
  newCoordinates: Position;
  newElevation: number;
  shouldUpdateCustomerPoints?: boolean;
};

export const moveNode: ModelOperation<InputData> = (
  { assets, topology, customerPointsLookup },
  { nodeId, newCoordinates, newElevation, shouldUpdateCustomerPoints = false },
) => {
  const node = getNode(assets, nodeId) as NodeAsset;
  const oldCoordinates = node.coordinates;

  const updatedNode = node.copy();
  updatedNode.setCoordinates(newCoordinates);
  updatedNode.setElevation(newElevation);

  const updatedAssets = new AssetsMap();
  const updatedCustomerPoints = new CustomerPoints();

  const linkIds = topology.getLinks(node.id);

  for (const linkId of linkIds) {
    const link = assets.get(linkId) as LinkAsset;
    const linkCopy = link.copy();
    updateLinkCoordinates(linkCopy, oldCoordinates, newCoordinates);

    if (linkCopy.type === "pipe" && shouldUpdateCustomerPoints) {
      const pipeCopy = linkCopy as Pipe;
      const [startNode, endNode] = pipeCopy.connections.map(
        (nodeId) => assets.get(nodeId) as NodeAsset,
      );
      const connectedCustomerPoints = customerPointsLookup.getCustomerPoints(
        pipeCopy.id,
      );
      const customerPointsConnectedToPipe = connectedCustomerPoints
        ? Array.from(connectedCustomerPoints)
        : [];

      for (const customerPoint of customerPointsConnectedToPipe) {
        const customerPointCopy = customerPoint.copyDisconnected();
        const snapPoint = findNearestSnappingPoint(pipeCopy, customerPointCopy);
        const junctionId = findJunctionForCustomerPoint(
          {
            id: startNode.id,
            type: startNode.type,
            coordinates: startNode.coordinates,
          },
          {
            id: endNode.id,
            type: endNode.type,
            coordinates: endNode.coordinates,
          },
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

    updatedAssets.set(linkCopy.id, linkCopy);
  }

  return {
    note: "Move node",
    putAssets: [updatedNode, ...updatedAssets.values()],
    putCustomerPoints:
      updatedCustomerPoints.size > 0
        ? [...updatedCustomerPoints.values()]
        : undefined,
  };
};

const updateLinkCoordinates = (
  linkCopy: LinkAsset,
  oldNodeCoordinates: Position,
  newNodeCoordinates: Position,
) => {
  const newLinkCoordinates = [...linkCopy.coordinates];
  if (linkCopy.isStart(oldNodeCoordinates)) {
    newLinkCoordinates[0] = newNodeCoordinates;
  }
  if (linkCopy.isEnd(oldNodeCoordinates)) {
    newLinkCoordinates[newLinkCoordinates.length - 1] = newNodeCoordinates;
  }

  linkCopy.setCoordinates(newLinkCoordinates);
  return linkCopy;
};

const findNearestSnappingPoint = (
  pipe: Pipe,
  customerPoint: CustomerPoint,
): Position => {
  const pipeLineString = lineString(pipe.coordinates);
  const customerPointGeometry = point(customerPoint.coordinates);

  const nearestPoint = turfNearestPointOnLine(
    pipeLineString,
    customerPointGeometry,
  );
  return nearestPoint.geometry.coordinates;
};
