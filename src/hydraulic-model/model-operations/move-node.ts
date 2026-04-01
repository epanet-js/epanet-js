import { Position } from "geojson";
import { AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { AssetsMap, getNode } from "../assets-map";
import { ModelOperation } from "../model-operation";
import { CustomerPoint, CustomerPoints } from "../customer-points";
import { Pipe } from "../asset-types/pipe";
import { findJunctionForCustomerPoint } from "../utilities/junction-assignment";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "src/lib/geometry";
import { splitPipe } from "./split-pipe";
import { HydraulicModel } from "../hydraulic-model";
import { AssetFactory } from "../factories/asset-factory";
import { LabelManager } from "../label-manager";
import { computeLinkLength } from "../asset-types/link";
import { Unit } from "src/quantity";

type InputData = {
  nodeId: AssetId;
  newCoordinates: Position;
  newElevation: number;
  shouldUpdateCustomerPoints?: boolean;
  pipeIdToSplit?: AssetId;
  lengthUnit: Unit;
  assetFactory: AssetFactory;
  labelManager: LabelManager;
};

export const moveNode: ModelOperation<InputData> = (
  hydraulicModel,
  {
    nodeId,
    newCoordinates,
    newElevation,
    shouldUpdateCustomerPoints = false,
    pipeIdToSplit,
    lengthUnit,
    assetFactory,
    labelManager,
  },
) => {
  if (pipeIdToSplit) {
    return moveNodeWithPipeSplitting(
      hydraulicModel,
      nodeId,
      newCoordinates,
      newElevation,
      shouldUpdateCustomerPoints,
      pipeIdToSplit,
      lengthUnit,
      assetFactory,
      labelManager,
    );
  }

  return moveNodeStandard(hydraulicModel, {
    nodeId,
    newCoordinates,
    newElevation,
    shouldUpdateCustomerPoints,
    lengthUnit,
    assetFactory,
    labelManager,
  });
};

const moveNodeStandard: ModelOperation<Omit<InputData, "pipeIdToSplit">> = (
  hydraulicModel,
  {
    nodeId,
    newCoordinates,
    newElevation,
    shouldUpdateCustomerPoints = false,
    lengthUnit,
  },
) => {
  const { assets, topology, customerPointsLookup } = hydraulicModel;
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
    updateLinkCoordinates(linkCopy, oldCoordinates, newCoordinates, lengthUnit);

    if (linkCopy.type === "pipe" && shouldUpdateCustomerPoints) {
      const pipeCopy = linkCopy as Pipe;
      const [startNode, endNode] = pipeCopy.connections.map(
        (connectedNodeId) =>
          connectedNodeId === nodeId
            ? updatedNode
            : (assets.get(connectedNodeId) as NodeAsset),
      );
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

const moveNodeWithPipeSplitting = (
  hydraulicModel: HydraulicModel,
  nodeId: AssetId,
  newCoordinates: Position,
  newElevation: number,
  shouldUpdateCustomerPoints: boolean,
  pipeIdToSplit: AssetId,
  lengthUnit: Unit,
  assetFactory: AssetFactory,
  labelManager: LabelManager,
) => {
  const { assets } = hydraulicModel;

  const pipe = assets.get(pipeIdToSplit) as Pipe;
  if (!pipe || pipe.type !== "pipe") {
    throw new Error(`Invalid pipe ID: ${pipeIdToSplit}`);
  }

  const node = getNode(assets, nodeId) as NodeAsset;

  const updatedNode = node.copy();
  updatedNode.setCoordinates(newCoordinates);
  updatedNode.setElevation(newElevation);

  const moveResult = moveNodeStandard(hydraulicModel, {
    nodeId,
    newCoordinates,
    newElevation,
    shouldUpdateCustomerPoints,
    lengthUnit,
    assetFactory,
    labelManager,
  });

  const splitResult = splitPipe(hydraulicModel, {
    pipe,
    splits: [updatedNode],
    lengthUnit,
    assetFactory,
    labelManager,
  });

  const allPutAssets = [
    ...(moveResult.putAssets || []),
    ...(splitResult.putAssets || []),
  ];

  const allPutCustomerPoints = [
    ...(moveResult.putCustomerPoints || []),
    ...(splitResult.putCustomerPoints || []),
  ];

  return {
    note: "Move node and split pipe",
    putAssets: allPutAssets,
    putCustomerPoints:
      allPutCustomerPoints.length > 0 ? allPutCustomerPoints : undefined,
    deleteAssets: splitResult.deleteAssets,
  };
};

const updateLinkCoordinates = (
  linkCopy: LinkAsset,
  oldNodeCoordinates: Position,
  newNodeCoordinates: Position,
  lengthUnit: Unit,
) => {
  const newLinkCoordinates = [...linkCopy.coordinates];
  if (linkCopy.isStart(oldNodeCoordinates)) {
    newLinkCoordinates[0] = newNodeCoordinates;
  }
  if (linkCopy.isEnd(oldNodeCoordinates)) {
    newLinkCoordinates[newLinkCoordinates.length - 1] = newNodeCoordinates;
  }

  linkCopy.setCoordinates(newLinkCoordinates);
  linkCopy.setProperty("length", computeLinkLength(linkCopy, lengthUnit));
  return linkCopy;
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
