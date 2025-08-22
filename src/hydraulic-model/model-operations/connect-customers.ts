import { CustomerPoint } from "../customer-points";
import { ModelOperation } from "../model-operation";
import { LinkAsset, NodeAsset } from "../asset-types";
import { Position } from "src/types";
import { findJunctionForCustomerPoint } from "../utilities/junction-assignment";

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

    const connectedCopy = customerPoint.copyDisconnected();
    connectedCopy.connect({
      pipeId,
      snapPoint,
      junctionId: targetNodeId,
    });

    connectedCustomerPoints.push(connectedCopy);
  }

  return {
    note: "Connect customers",
    putCustomerPoints: connectedCustomerPoints,
  };
};
