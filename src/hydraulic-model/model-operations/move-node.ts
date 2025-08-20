import { Position } from "geojson";
import { AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { AssetsMap, getNode, getLink } from "../assets-map";
import { ModelOperation } from "../model-operation";
import { CustomerPoint } from "../customer-points";
import { Pipe } from "../asset-types/pipe";
import { lineString, point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";

type InputData = {
  nodeId: AssetId;
  newCoordinates: Position;
  newElevation: number;
  updateCustomerPoints?: boolean;
};

export const moveNode: ModelOperation<InputData> = (
  { assets, topology, customerPoints },
  { nodeId, newCoordinates, newElevation, updateCustomerPoints = false },
) => {
  const node = getNode(assets, nodeId) as NodeAsset;
  const oldCoordinates = node.coordinates;

  const updatedNode = node.copy();
  updatedNode.setCoordinates(newCoordinates);
  updatedNode.setElevation(newElevation);

  const linkIds = topology.getLinks(node.id);

  const updatedLinks = updateMatchingEndpoints(
    assets,
    linkIds,
    oldCoordinates,
    newCoordinates,
  );

  const updatedCustomerPoints = updateCustomerPoints
    ? updateCustomerPointsSnapPoints(assets, customerPoints, updatedLinks)
    : [];

  return {
    note: "Move node",
    putAssets: [updatedNode, ...updatedLinks],
    putCustomerPoints:
      updatedCustomerPoints.length > 0 ? updatedCustomerPoints : undefined,
  };
};

const updateMatchingEndpoints = (
  assets: AssetsMap,
  linkIds: AssetId[],
  oldCoordinates: Position,
  newCoordinates: Position,
) => {
  const updatedLinks = [];
  for (const linkId of linkIds) {
    const link = getLink(assets, linkId) as LinkAsset;
    const linkCopy = link.copy();

    const newLinkCoordinates = [...linkCopy.coordinates];
    if (linkCopy.isStart(oldCoordinates)) {
      newLinkCoordinates[0] = newCoordinates;
    }
    if (linkCopy.isEnd(oldCoordinates)) {
      newLinkCoordinates[newLinkCoordinates.length - 1] = newCoordinates;
    }

    linkCopy.setCoordinates(newLinkCoordinates);
    updatedLinks.push(linkCopy);
  }
  return updatedLinks;
};

const updateCustomerPointsSnapPoints = (
  assets: AssetsMap,
  customerPoints: Map<string, CustomerPoint>,
  updatedLinks: LinkAsset[],
): CustomerPoint[] => {
  const updatedCustomerPoints: CustomerPoint[] = [];

  for (const link of updatedLinks) {
    if (link.type !== "pipe") continue;

    const pipe = link as Pipe;
    const customerPointIds = pipe.customerPointIds;

    for (const customerPointId of customerPointIds) {
      const customerPoint = customerPoints.get(customerPointId);
      if (!customerPoint?.connection) continue;

      const pipeGeometry = pipe.feature.geometry;
      if (pipeGeometry.type !== "LineString") continue;

      const pipeLineString = lineString(pipeGeometry.coordinates);
      const customerPointGeometry = point(customerPoint.coordinates);
      const nearestPoint = nearestPointOnLine(
        pipeLineString,
        customerPointGeometry,
      );
      const newSnapPoint = nearestPoint.geometry.coordinates as Position;

      const currentSnapPoint = customerPoint.connection.snapPoint;
      const snapPointChanged = !arraysEqual(currentSnapPoint, newSnapPoint);

      if (snapPointChanged) {
        const updatedCustomerPoint = customerPoint.copy();
        updatedCustomerPoint.connect({
          ...customerPoint.connection,
          snapPoint: newSnapPoint,
        });
        updatedCustomerPoints.push(updatedCustomerPoint);
      }
    }
  }

  return updatedCustomerPoints;
};

const arraysEqual = (a: Position, b: Position): boolean => {
  return (
    a.length === b.length && a.every((val, i) => Math.abs(val - b[i]) < 1e-6)
  );
};
