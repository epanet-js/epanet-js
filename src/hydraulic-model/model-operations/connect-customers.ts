import { CustomerPoint } from "../customer-points";
import { ModelOperation } from "../model-operation";
import { Junction } from "../asset-types/junction";
import { Asset, LinkAsset, NodeAsset } from "../asset-types";
import { Position } from "src/types";
import { findJunctionForCustomerPoint } from "../utilities/junction-assignment";
import turfDistance from "@turf/distance";

type InputData = {
  customerPointIds: readonly string[];
  pipeId: string;
  snapPoints: readonly Position[];
};

export const connectCustomers: ModelOperation<InputData> = (
  { customerPoints, assets },
  { customerPointIds, pipeId, snapPoints },
) => {
  if (customerPointIds.length !== snapPoints.length) {
    throw new Error(
      "Customer point IDs and snap points arrays must have the same length",
    );
  }

  const pipe = assets.get(pipeId) as LinkAsset;
  if (!pipe || !pipe.isLink) {
    throw new Error(`Pipe with id ${pipeId} not found`);
  }

  const [startNodeId, endNodeId] = pipe.connections;
  const startNode = assets.get(startNodeId);
  const endNode = assets.get(endNodeId);

  if (!startNode || startNode.isLink) {
    throw new Error(`Start node ${startNodeId} not found for pipe ${pipeId}`);
  }
  if (!endNode || endNode.isLink) {
    throw new Error(`End node ${endNodeId} not found for pipe ${pipeId}`);
  }

  const connectedCustomerPoints: CustomerPoint[] = [];
  const modifiedJunctions = new Map<string, Junction>();

  for (let i = 0; i < customerPointIds.length; i++) {
    const customerPointId = customerPointIds[i];
    const snapPoint = snapPoints[i];

    const customerPoint = customerPoints.get(customerPointId);
    if (!customerPoint) {
      throw new Error(`Customer point with id ${customerPointId} not found`);
    }

    const startNodeData = {
      id: startNodeId,
      type: startNode.type,
      coordinates: (startNode as NodeAsset).coordinates,
    };
    const endNodeData = {
      id: endNodeId,
      type: endNode.type,
      coordinates: (endNode as NodeAsset).coordinates,
    };

    const targetNodeId = findJunctionForCustomerPoint(
      startNodeData,
      endNodeData,
      snapPoint,
    );

    if (!targetNodeId) {
      throw new Error(
        `No junction found to connect customer point ${customerPointId} to pipe ${pipeId}`,
      );
    }

    const targetNode = assets.get(targetNodeId) as Junction;

    if (customerPoint.connection?.junctionId) {
      const oldJunctionId = customerPoint.connection.junctionId;
      const oldJunction = assets.get(oldJunctionId) as Junction;

      if (oldJunction && oldJunctionId !== targetNodeId) {
        let oldJunctionCopy: Junction;
        if (modifiedJunctions.has(oldJunctionId)) {
          oldJunctionCopy = modifiedJunctions.get(oldJunctionId)!;
        } else {
          oldJunctionCopy = oldJunction.copy();
          modifiedJunctions.set(oldJunctionId, oldJunctionCopy);
        }
        oldJunctionCopy.removeCustomerPoint(customerPoint);
      }
    }

    let targetJunctionCopy: Junction;
    if (modifiedJunctions.has(targetNodeId)) {
      targetJunctionCopy = modifiedJunctions.get(targetNodeId)!;
    } else {
      targetJunctionCopy = targetNode.copy();
      modifiedJunctions.set(targetNodeId, targetJunctionCopy);
    }

    const connectionDistance = turfDistance(snapPoint, targetNode.coordinates, {
      units: "meters",
    });

    const connectedCopy = customerPoint.copy();
    connectedCopy.connect({
      pipeId,
      snapPoint,
      distance: connectionDistance,
      junctionId: targetNodeId,
    });

    targetJunctionCopy.assignCustomerPoint(connectedCopy);
    connectedCustomerPoints.push(connectedCopy);
  }

  const putAssets: Asset[] = Array.from(modifiedJunctions.values());

  return {
    note: "Connect customers",
    putCustomerPoints: connectedCustomerPoints,
    ...(putAssets.length > 0 && { putAssets }),
  };
};
