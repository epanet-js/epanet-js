import { AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { ModelOperation, ModelMoment } from "../model-operation";
import { CustomerPoint } from "../customer-points";
import { addLinkWithActiveTopology } from "./add-link-with-active-topology";
import { findJunctionForCustomerPoint } from "../utilities/junction-assignment";
import { HydraulicModel } from "../hydraulic-model";
import { lineString, point } from "@turf/helpers";
import { Position } from "geojson";
import { findNearestPointOnLine } from "src/lib/geometry";
import { Moment } from "src/lib/persistence/moment";

type InputData = {
  sourceLinkId: AssetId;
  newLink: LinkAsset;
  startNode: NodeAsset;
  endNode: NodeAsset;
  startPipeId?: AssetId;
  endPipeId?: AssetId;
};

export const replaceLinkWithActiveTopology: ModelOperation<InputData> = (
  hydraulicModel,
  { sourceLinkId, newLink, startNode, endNode, startPipeId, endPipeId },
) => {
  const sourceLink = hydraulicModel.assets.get(sourceLinkId);
  if (!sourceLink || sourceLink.isNode) {
    throw new Error(`Source link with id ${sourceLinkId} not found`);
  }

  const sourceLinkAsset = sourceLink as LinkAsset;

  if (sourceLinkAsset.type !== newLink.type) {
    throw new Error(
      `Link types must match: source is ${sourceLinkAsset.type}, new is ${newLink.type}`,
    );
  }

  newLink.setProperty("isActive", sourceLink.isActive);
  if (!hydraulicModel.topology.hasNode(startNode.id)) {
    startNode.setProperty("isActive", sourceLink.isActive);
  }
  if (!hydraulicModel.topology.hasNode(endNode.id)) {
    endNode.setProperty("isActive", sourceLink.isActive);
  }

  const addLinkResult = addLinkWithActiveTopology(hydraulicModel, {
    link: newLink,
    startNode,
    endNode,
    startPipeId,
    endPipeId,
  });

  const reconnectedCustomerPoints =
    sourceLinkAsset.type === "pipe"
      ? reconnectCustomerPoints(
          hydraulicModel,
          sourceLinkId,
          newLink,
          startNode,
          endNode,
          addLinkResult,
        )
      : [];

  const oldNodesWithChanges = reevaluateAffectedNodes(
    hydraulicModel,
    sourceLinkAsset,
    addLinkResult.putAssets || [],
  );

  const allPutAssets = [
    ...(addLinkResult.putAssets || []),
    ...oldNodesWithChanges,
  ];

  const allPutCustomerPoints = [
    ...(addLinkResult.putCustomerPoints || []),
    ...reconnectedCustomerPoints,
  ];

  return {
    note: `Replace ${sourceLinkAsset.type}`,
    putAssets: allPutAssets,
    deleteAssets: [...(addLinkResult.deleteAssets || []), sourceLinkId],
    putCustomerPoints:
      allPutCustomerPoints.length > 0 ? allPutCustomerPoints : undefined,
  };
};

const reconnectCustomerPoints = (
  hydraulicModel: HydraulicModel,
  sourceLinkId: AssetId,
  newLink: LinkAsset,
  startNode: NodeAsset,
  endNode: NodeAsset,
  addLinkResult: ModelMoment,
): CustomerPoint[] => {
  const connectedCustomerPoints =
    hydraulicModel.customerPointsLookup.getCustomerPoints(sourceLinkId);

  if (connectedCustomerPoints.size === 0) {
    return [];
  }

  const actualNewPipe = addLinkResult.putAssets!.find(
    (asset) => asset.type === "pipe" && asset.id === newLink.id,
  );

  if (!actualNewPipe) {
    return [];
  }

  const reconnectedCustomerPoints: CustomerPoint[] = [];

  for (const customerPoint of connectedCustomerPoints) {
    if (customerPoint.connection?.snapPoint) {
      const customerPointGeometry = point(customerPoint.coordinates);
      const newPipeLineString = lineString(
        actualNewPipe.coordinates as Position[],
      );

      const nearestPointResult = findNearestPointOnLine(
        newPipeLineString,
        customerPointGeometry,
      );

      if (nearestPointResult.coordinates) {
        const newSnapPoint = nearestPointResult.coordinates;

        const startNodeData = {
          id: startNode.id,
          type: startNode.type,
          coordinates: startNode.coordinates,
        };
        const endNodeData = {
          id: endNode.id,
          type: endNode.type,
          coordinates: endNode.coordinates,
        };

        const targetJunctionId = findJunctionForCustomerPoint(
          startNodeData,
          endNodeData,
          newSnapPoint,
        );

        if (targetJunctionId) {
          const reconnectedPoint = customerPoint.copyDisconnected();
          reconnectedPoint.connect({
            pipeId: actualNewPipe.id,
            snapPoint: newSnapPoint,
            junctionId: targetJunctionId,
          });
          reconnectedCustomerPoints.push(reconnectedPoint);
        } else {
          const disconnectedPoint = customerPoint.copyDisconnected();
          reconnectedCustomerPoints.push(disconnectedPoint);
        }
      } else {
        const disconnectedPoint = customerPoint.copyDisconnected();
        reconnectedCustomerPoints.push(disconnectedPoint);
      }
    }
  }

  return reconnectedCustomerPoints;
};

const reevaluateAffectedNodes = (
  hydraulicModel: HydraulicModel,
  originalLink: LinkAsset,
  putAssets: Moment["putAssets"],
): NodeAsset[] => {
  if (!originalLink.isActive) return [];

  const nodesWithDifferentActiveTopologyStatus: NodeAsset[] = [];
  const putAssetIds = new Set(putAssets.map((asset) => asset.id));

  for (const nodeId of originalLink.connections) {
    if (putAssetIds.has(nodeId)) continue;

    const node = hydraulicModel.assets.get(nodeId) as NodeAsset;
    if (!node || node.isLink) continue;

    const connectedLinkIds = hydraulicModel.topology.getLinks(nodeId);
    const hasOtherActiveLinks = connectedLinkIds.some((linkId) => {
      if (linkId === originalLink.id) return false;
      const link = hydraulicModel.assets.get(linkId) as LinkAsset;
      return link && link.isActive;
    });

    if (!hasOtherActiveLinks) {
      const nodeCopy = node.copy();
      nodeCopy.setProperty("isActive", false);
      nodesWithDifferentActiveTopologyStatus.push(nodeCopy);
    }
  }

  return nodesWithDifferentActiveTopologyStatus;
};
