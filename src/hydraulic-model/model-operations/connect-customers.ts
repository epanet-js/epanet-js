import { CustomerPoint } from "../customer-points";
import { ModelOperation } from "../model-operation";
import { Junction } from "../asset-types/junction";
import { Pipe } from "../asset-types/pipe";
import { Asset, LinkAsset, NodeAsset } from "../asset-types";
import { Position } from "src/types";
import { findJunctionForCustomerPoint } from "../utilities/junction-assignment";
import { AssetsMap } from "../hydraulic-model";

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
  const modifiedPipes = new Map<string, Pipe>();

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

    removePreviousConnections(
      customerPoint,
      assets,
      modifiedJunctions,
      modifiedPipes,
    );

    updateConnections(
      customerPoint,
      connectedCopy,
      targetNodeId,
      pipeId,
      pipe as Pipe,
      assets,
      modifiedJunctions,
      modifiedPipes,
    );

    connectedCustomerPoints.push(connectedCopy);
  }

  const putAssets: Asset[] = [
    ...Array.from(modifiedJunctions.values()),
    ...Array.from(modifiedPipes.values()),
  ];

  return {
    note: "Connect customers",
    putCustomerPoints: connectedCustomerPoints,
    ...(putAssets.length > 0 && { putAssets }),
  };
};

const removePreviousConnections = (
  customerPoint: CustomerPoint,
  assets: AssetsMap,
  modifiedJunctions: Map<string, Junction>,
  modifiedPipes: Map<string, Pipe>,
): void => {
  if (customerPoint.connection?.junctionId) {
    const junctionId = customerPoint.connection.junctionId;
    const originalJunction = assets.get(junctionId) as Junction;

    if (originalJunction) {
      let junctionCopy: Junction;
      if (modifiedJunctions.has(junctionId)) {
        junctionCopy = modifiedJunctions.get(junctionId)!;
      } else {
        junctionCopy = originalJunction.copy();
        modifiedJunctions.set(junctionId, junctionCopy);
      }

      junctionCopy.removeCustomerPoint(customerPoint.id);
    }
  }

  if (customerPoint.connection?.pipeId) {
    const pipeId = customerPoint.connection.pipeId;
    const originalPipe = assets.get(pipeId) as Pipe;

    if (originalPipe) {
      let pipeCopy: Pipe;
      if (modifiedPipes.has(pipeId)) {
        pipeCopy = modifiedPipes.get(pipeId)!;
      } else {
        pipeCopy = originalPipe.copy();
        modifiedPipes.set(pipeId, pipeCopy);
      }

      pipeCopy.removeCustomerPoint(customerPoint.id);
    }
  }
};

const updateConnections = (
  customerPoint: CustomerPoint,
  connectedCopy: CustomerPoint,
  targetNodeId: string,
  pipeId: string,
  pipe: Pipe,
  assets: AssetsMap,
  modifiedJunctions: Map<string, Junction>,
  modifiedPipes: Map<string, Pipe>,
): void => {
  let junctionCopy: Junction;
  if (!modifiedJunctions.has(targetNodeId)) {
    const targetNode = assets.get(targetNodeId) as Junction;
    junctionCopy = targetNode.copy();
    modifiedJunctions.set(targetNodeId, junctionCopy);
  } else {
    junctionCopy = modifiedJunctions.get(targetNodeId)!;
  }

  junctionCopy.assignCustomerPoint(customerPoint.id);

  let pipeCopy: Pipe;
  if (!modifiedPipes.has(pipeId)) {
    pipeCopy = pipe.copy();
    modifiedPipes.set(pipeId, pipeCopy);
  } else {
    pipeCopy = modifiedPipes.get(pipeId)!;
  }

  pipeCopy.assignCustomerPoint(customerPoint.id);
};
