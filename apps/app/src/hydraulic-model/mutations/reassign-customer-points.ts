import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "@epanet-js/geometry";
import { Position } from "src/types";
import {
  NodeAsset,
  Pipe,
  CustomerPoint,
  CustomerPoints,
} from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "../hydraulic-model";
import { findJunctionForCustomerPoint } from "../utilities/junction-assignment";

const findNearestSnappingPoint = (
  pipe: Pipe,
  customerPoint: CustomerPoint,
): Position => {
  const pipeLineString = lineString(pipe.coordinates);
  const customerPointGeometry = point(customerPoint.coordinates);

  const result = findNearestPointOnLine(pipeLineString, customerPointGeometry);
  return result.coordinates;
};

export const reassignCustomerPoints = (
  pipe: Pipe,
  node: NodeAsset,
  assets: HydraulicModel["assets"],
  customerPointsLookup: HydraulicModel["customerPointsLookup"],
  updatedCustomerPoints: CustomerPoints,
): void => {
  const connectedCustomerPoints = customerPointsLookup.getCustomerPoints(
    pipe.id,
  );

  for (const customerPoint of connectedCustomerPoints) {
    if (!updatedCustomerPoints.has(customerPoint.id)) {
      const [startNode, endNode] = pipe.connections.map((connectedNodeId) =>
        connectedNodeId === node.id
          ? node
          : (assets.get(connectedNodeId) as NodeAsset),
      );

      const customerPointCopy = customerPoint.copyDisconnected();
      const snapPoint = findNearestSnappingPoint(pipe, customerPointCopy);
      const junctionId = findJunctionForCustomerPoint(
        startNode,
        endNode,
        snapPoint,
      );

      if (junctionId) {
        customerPointCopy.connect({
          pipeId: pipe.id,
          snapPoint,
          junctionId,
        });
      }

      updatedCustomerPoints.set(customerPointCopy.id, customerPointCopy);
    }
  }
};
