import { Position } from "geojson";
import { AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { CustomerPoint, CustomerPoints } from "../customer-points";
import { Pipe } from "../asset-types/pipe";
import { findJunctionForCustomerPoint } from "../utilities/junction-assignment";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "src/lib/geometry";

type InputData = {
  linkId: AssetId;
  newVertices: Position[];
};

export const updateVertices: ModelOperation<InputData> = (
  hydraulicModel,
  { linkId, newVertices },
) => {
  const { assets, customerPointsLookup } = hydraulicModel;

  const link = assets.get(linkId);
  if (!link || !link.isLink) {
    throw new Error(`Link ${linkId} not found or is not a link`);
  }

  const linkAsset = link as LinkAsset;
  const linkCopy = linkAsset.copy();

  const [startNodeId, endNodeId] = (linkAsset as any).connections;
  const startNode = assets.get(startNodeId) as NodeAsset;
  const endNode = assets.get(endNodeId) as NodeAsset;

  if (!startNode || !endNode || startNode.isLink || endNode.isLink) {
    throw new Error(`Invalid link connections for link ${linkId}`);
  }

  const newCoordinates = [
    startNode.coordinates,
    ...newVertices,
    endNode.coordinates,
  ];

  linkCopy.setCoordinates(newCoordinates);

  const updatedCustomerPoints = new CustomerPoints();

  if (linkCopy.type === "pipe") {
    const pipeCopy = linkCopy as Pipe;
    const connectedCustomerPoints = customerPointsLookup.getCustomerPoints(
      pipeCopy.id,
    );
    const customerPointsConnectedToPipe = Array.from(connectedCustomerPoints);

    for (const customerPoint of customerPointsConnectedToPipe) {
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

  return {
    note: "Update vertices",
    putAssets: [linkCopy],
    putCustomerPoints:
      updatedCustomerPoints.size > 0
        ? [...updatedCustomerPoints.values()]
        : undefined,
  };
};

const findNearestSnappingPoint = (
  pipe: Pipe,
  customerPoint: CustomerPoint,
): Position => {
  const pipeLineString = lineString(pipe.coordinates);
  const customerPointGeometry = point(customerPoint.coordinates);

  const result = findNearestPointOnLine(pipeLineString, customerPointGeometry);
  return result.coordinates;
};
