import { Position } from "geojson";
import {
  AssetId,
  LinkAsset,
  NodeAsset,
  CustomerPoint,
  CustomerPoints,
  Pipe,
  AssetFactory,
  LabelManager,
  computeLinkLength,
} from "@epanet-js/hydraulic-model";
import { getNode } from "@epanet-js/hydraulic-model";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { findJunctionForCustomerPoint } from "../utilities/junction-assignment";
import { lineString, point } from "@turf/helpers";
import { findNearestPointOnLine } from "@epanet-js/geometry";
import { splitPipe } from "./split-pipe";
import { HydraulicModel } from "../hydraulic-model";
import { inferNodeIsActive } from "../utilities/active-topology";
import { Unit } from "@epanet-js/quantity";
import {
  changeSet,
  dropAssets,
  putAssets,
  putCustomerPoints,
} from "../change-sets";

type InputData = {
  nodeId: AssetId;
  newCoordinates: Position;
  newElevation: number | null;
  shouldUpdateCustomerPoints?: boolean;
  pipeIdToSplit?: AssetId;
  lengthUnit: Unit;
  assetFactory: AssetFactory;
  labelManager: LabelManager;
  precision?: number;
};

export const moveNode: ModelOperation<InputData> = (hydraulicModel, data) => {
  const { note, node, links, newPipes, removedPipeIds, customerPoints } =
    planMove(hydraulicModel, data);

  return changeSet(hydraulicModel, note, [
    dropAssets(removedPipeIds),
    putAssets([node, ...links, ...newPipes]),
    putCustomerPoints(customerPoints),
  ]);
};

export const moveNodeDeprecated: ModelOperationDeprecated<InputData> = (
  hydraulicModel,
  data,
) => {
  const { note, node, links, newPipes, removedPipeIds, customerPoints } =
    planMove(hydraulicModel, data);

  return {
    note,
    putAssets: [node, ...links, ...newPipes],
    putCustomerPoints: customerPoints.length > 0 ? customerPoints : undefined,
    ...(removedPipeIds.length > 0 && { deleteAssets: removedPipeIds }),
  };
};

export const moveNodeAndLinks = (
  hydraulicModel: HydraulicModel,
  {
    nodeId,
    newCoordinates,
    newElevation,
    lengthUnit,
  }: Pick<
    InputData,
    "nodeId" | "newCoordinates" | "newElevation" | "lengthUnit"
  >,
): { node: NodeAsset; links: LinkAsset[] } => {
  const { assets, topology } = hydraulicModel;
  const node = getNode(assets, nodeId) as NodeAsset;
  const oldCoordinates = node.coordinates;

  const updatedNode = node.copy();
  updatedNode.setCoordinates(newCoordinates);
  if (newElevation !== null) updatedNode.setElevation(newElevation);

  const updatedLinks = topology.getLinks(node.id).map((linkId) => {
    const linkCopy = (assets.get(linkId) as LinkAsset).copy();
    return updateLinkCoordinates(
      linkCopy,
      oldCoordinates,
      newCoordinates,
      lengthUnit,
    );
  });

  return { node: updatedNode, links: updatedLinks };
};

const planMove = (
  hydraulicModel: HydraulicModel,
  {
    nodeId,
    newCoordinates,
    newElevation,
    shouldUpdateCustomerPoints = false,
    pipeIdToSplit,
    lengthUnit,
    assetFactory,
    labelManager,
    precision,
  }: InputData,
) => {
  const pipeToSplit = pipeIdToSplit
    ? getPipeToSplit(hydraulicModel, pipeIdToSplit)
    : undefined;

  const { node, links } = moveNodeAndLinks(hydraulicModel, {
    nodeId,
    newCoordinates,
    newElevation,
    lengthUnit,
  });

  const movedCustomerPoints = shouldUpdateCustomerPoints
    ? reconnectCustomerPoints(hydraulicModel, node, links, precision)
    : [];

  if (!pipeToSplit) {
    return {
      note: "moveNode" as const,
      node,
      links,
      newPipes: [] as Pipe[],
      removedPipeIds: [] as AssetId[],
      customerPoints: movedCustomerPoints,
    };
  }

  const split = splitPipe(hydraulicModel, {
    pipe: pipeToSplit,
    splits: [node],
    lengthUnit,
    assetFactory,
    labelManager,
  });

  const isActive = inferNodeIsActive(
    node,
    new Set([split.removedPipeId]),
    split.newPipes,
    hydraulicModel.topology,
    hydraulicModel.assets,
  );
  const activatedNode = node.copy();
  activatedNode.setProperty("isActive", isActive);

  return {
    note: "moveNode" as const,
    node: activatedNode,
    links,
    newPipes: split.newPipes,
    removedPipeIds: [split.removedPipeId],
    customerPoints: [...movedCustomerPoints, ...split.customerPoints],
  };
};

const getPipeToSplit = (
  hydraulicModel: HydraulicModel,
  pipeId: AssetId,
): Pipe => {
  const pipe = hydraulicModel.assets.get(pipeId) as Pipe;
  if (!pipe || pipe.type !== "pipe") {
    throw new Error(`Invalid pipe ID: ${pipeId}`);
  }
  return pipe;
};

const reconnectCustomerPoints = (
  hydraulicModel: HydraulicModel,
  movedNode: NodeAsset,
  movedLinks: LinkAsset[],
  precision?: number,
): CustomerPoint[] => {
  const { assets, customerPointsLookup } = hydraulicModel;
  const updatedCustomerPoints = new CustomerPoints();

  for (const link of movedLinks) {
    if (link.type !== "pipe") continue;

    const pipe = link as Pipe;
    const [startNode, endNode] = pipe.connections.map((connectedNodeId) =>
      connectedNodeId === movedNode.id
        ? movedNode
        : (assets.get(connectedNodeId) as NodeAsset),
    );

    for (const customerPoint of customerPointsLookup.getCustomerPoints(
      pipe.id,
    )) {
      const customerPointCopy = customerPoint.copyDisconnected();
      const snapPoint = findNearestSnappingPoint(
        pipe,
        customerPointCopy,
        precision,
      );
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

  return [...updatedCustomerPoints.values()];
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
  precision?: number,
): Position => {
  const pipeLineString = lineString(pipe.coordinates);
  const customerPointGeometry = point(customerPoint.coordinates);

  const result = findNearestPointOnLine(pipeLineString, customerPointGeometry, {
    precision,
  });
  return result.coordinates;
};
