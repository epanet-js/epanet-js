import {
  AssetId,
  LinkAsset,
  NodeAsset,
  CustomerPoints,
  Pipe,
  CustomerPointsLookup,
  isNodeAsset,
  computeLinkLength,
} from "@epanet-js/hydraulic-model";
import {
  DemandAssignment,
  ModelOperation,
  ModelOperationDeprecated,
} from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { AssetsMap } from "@epanet-js/hydraulic-model";
import { Topology } from "@epanet-js/hydraulic-model";
import { updateLinkConnections } from "../mutations/update-link-connections";
import { reassignCustomerPoints } from "../mutations/reassign-customer-points";
import { getJunctionDemands } from "@epanet-js/hydraulic-model";
import { Unit } from "@epanet-js/quantity";
import {
  changeSet,
  dropAssets,
  putAssets,
  putCustomerPoints,
  setDemands,
} from "../change-sets";

type InputData = {
  sourceNodeId: AssetId;
  targetNodeId: AssetId;
  lengthUnit: Unit;
};

const determineWinner = (
  sourceNode: NodeAsset,
  targetNode: NodeAsset,
): { winnerNode: NodeAsset; loserNode: NodeAsset } => {
  const sourceType = sourceNode.type;
  const targetType = targetNode.type;

  const targetHasPriority =
    (targetType === "reservoir" || targetType === "tank") &&
    sourceType === "junction";

  if (targetHasPriority) {
    return { winnerNode: targetNode, loserNode: sourceNode };
  }

  return { winnerNode: sourceNode, loserNode: targetNode };
};

export const mergeNodes: ModelOperation<InputData> = (hydraulicModel, data) => {
  const {
    note,
    mergedNode,
    loserNodeId,
    updatedLinks,
    customerPoints,
    demands,
  } = planMerge(hydraulicModel, data);

  return changeSet(hydraulicModel, note, [
    dropAssets(loserNodeId),
    putAssets([mergedNode, ...updatedLinks]),
    putCustomerPoints(customerPoints),
    setDemands(demands),
  ]);
};

export const mergeNodesDeprecated: ModelOperationDeprecated<InputData> = (
  hydraulicModel,
  data,
) => {
  const {
    note,
    mergedNode,
    loserNodeId,
    updatedLinks,
    customerPoints,
    demands,
  } = planMerge(hydraulicModel, data);

  return {
    note,
    putAssets: [mergedNode, ...updatedLinks],
    deleteAssets: [loserNodeId],
    putCustomerPoints: customerPoints.length > 0 ? customerPoints : undefined,
    putDemands: demands.length > 0 ? { assignments: demands } : undefined,
  };
};

const planMerge = (
  hydraulicModel: HydraulicModel,
  { sourceNodeId, targetNodeId, lengthUnit }: InputData,
) => {
  const { sourceNode, targetNode } = validateAndGetNodes(
    hydraulicModel.assets,
    sourceNodeId,
    targetNodeId,
  );

  const { winnerNode, loserNode } = determineWinner(sourceNode, targetNode);

  const mergedNode = createMergedNode(winnerNode, loserNode, targetNode);

  const { updatedLinks, updatedCustomerPoints } = processConnectedLinks(
    winnerNode,
    loserNode,
    targetNode,
    hydraulicModel,
    lengthUnit,
  );

  const shouldBeActive = updatedLinks.length
    ? updatedLinks.some((link) => link.isActive)
    : true;
  mergedNode.setProperty("isActive", shouldBeActive);

  let demands: DemandAssignment[] = [];
  if (winnerNode.type === "junction" && loserNode.type === "junction") {
    const winnerDemands = getJunctionDemands(
      hydraulicModel.demands,
      winnerNode.id,
    );
    const loserDemands = getJunctionDemands(
      hydraulicModel.demands,
      loserNode.id,
    );
    const mergedDemands = [...winnerDemands, ...loserDemands];
    demands = [
      { junctionId: winnerNode.id, demands: mergedDemands },
      { junctionId: loserNode.id, demands: [] },
    ];
  } else if (loserNode.type === "junction") {
    const loserDemands = getJunctionDemands(
      hydraulicModel.demands,
      loserNode.id,
    );
    if (loserDemands.length > 0) {
      demands = [{ junctionId: loserNode.id, demands: [] }];
    }
  }

  return {
    note: "mergeNodes" as const,
    mergedNode,
    loserNodeId: loserNode.id,
    updatedLinks,
    customerPoints: [...updatedCustomerPoints.values()],
    demands,
  };
};

const validateAndGetNodes = (
  assets: AssetsMap,
  sourceNodeId: AssetId,
  targetNodeId: AssetId,
): { sourceNode: NodeAsset; targetNode: NodeAsset } => {
  const sourceNode = assets.get(sourceNodeId) as NodeAsset;
  const targetNode = assets.get(targetNodeId) as NodeAsset;

  if (!sourceNode || !isNodeAsset(sourceNode)) {
    throw new Error(`Invalid source node ID: ${sourceNodeId}`);
  }

  if (!targetNode || !isNodeAsset(targetNode)) {
    throw new Error(`Invalid target node ID: ${targetNodeId}`);
  }

  return { sourceNode, targetNode };
};

const createMergedNode = (
  winnerNode: NodeAsset,
  _loserNode: NodeAsset,
  targetNode: NodeAsset,
): NodeAsset => {
  const winnerNodeCopy = winnerNode.copy();
  winnerNodeCopy.setCoordinates(targetNode.coordinates);
  winnerNodeCopy.setElevation(targetNode.elevation);

  return winnerNodeCopy;
};

const updateLinkCoordinates = (
  link: LinkAsset,
  nodeId: AssetId,
  newCoordinates: [number, number],
  lengthUnit: Unit,
): void => {
  const coordinates = link.coordinates;
  const updatedCoordinates = [...coordinates];

  if (link.connections[0] === nodeId) {
    updatedCoordinates[0] = newCoordinates;
  }
  if (link.connections[link.connections.length - 1] === nodeId) {
    updatedCoordinates[updatedCoordinates.length - 1] = newCoordinates;
  }

  link.setCoordinates(updatedCoordinates);
  link.setProperty("length", computeLinkLength(link, lengthUnit));
};

const processLinkCustomerPoints = (
  link: LinkAsset,
  winnerNode: NodeAsset,
  assets: AssetsMap,
  customerPointsLookup: CustomerPointsLookup,
  updatedCustomerPoints: CustomerPoints,
): void => {
  if (link.type === "pipe") {
    const pipe = link as Pipe;
    reassignCustomerPoints(
      pipe,
      winnerNode,
      assets,
      customerPointsLookup,
      updatedCustomerPoints,
    );
  }
};

const processConnectedLinks = (
  winnerNode: NodeAsset,
  loserNode: NodeAsset,
  targetNode: NodeAsset,
  hydraulicModel: HydraulicModel,
  lengthUnit: Unit,
): { updatedLinks: LinkAsset[]; updatedCustomerPoints: CustomerPoints } => {
  const { topology, assets, customerPointsLookup } = hydraulicModel;
  const updatedLinks: LinkAsset[] = [];
  const updatedCustomerPoints = new CustomerPoints();

  updateWinnerLinks(
    winnerNode.id,
    targetNode,
    topology,
    assets,
    winnerNode,
    customerPointsLookup,
    updatedLinks,
    updatedCustomerPoints,
    lengthUnit,
  );

  updateLoserLinks(
    loserNode.id,
    winnerNode.id,
    targetNode,
    topology,
    assets,
    winnerNode,
    customerPointsLookup,
    updatedLinks,
    updatedCustomerPoints,
    lengthUnit,
  );

  return { updatedLinks, updatedCustomerPoints };
};

const updateWinnerLinks = (
  winnerNodeId: AssetId,
  targetNode: NodeAsset,
  topology: Topology,
  assets: AssetsMap,
  winnerNode: NodeAsset,
  customerPointsLookup: CustomerPointsLookup,
  updatedLinks: LinkAsset[],
  updatedCustomerPoints: CustomerPoints,
  lengthUnit: Unit,
): void => {
  const winnerConnectedLinkIds = topology.getLinks(winnerNodeId);

  for (const linkId of winnerConnectedLinkIds) {
    const link = assets.get(linkId) as LinkAsset;
    const linkCopy = link.copy();

    updateLinkCoordinates(
      linkCopy,
      winnerNodeId,
      targetNode.coordinates as [number, number],
      lengthUnit,
    );
    updatedLinks.push(linkCopy);

    processLinkCustomerPoints(
      linkCopy,
      winnerNode,
      assets,
      customerPointsLookup,
      updatedCustomerPoints,
    );
  }
};

const updateLoserLinks = (
  loserNodeId: AssetId,
  winnerNodeId: AssetId,
  targetNode: NodeAsset,
  topology: Topology,
  assets: AssetsMap,
  winnerNode: NodeAsset,
  customerPointsLookup: CustomerPointsLookup,
  updatedLinks: LinkAsset[],
  updatedCustomerPoints: CustomerPoints,
  lengthUnit: Unit,
): void => {
  const loserConnectedLinkIds = topology.getLinks(loserNodeId);

  for (const linkId of loserConnectedLinkIds) {
    const link = assets.get(linkId) as LinkAsset;
    const linkCopy = link.copy();

    updateLinkConnections(linkCopy, loserNodeId, winnerNodeId);
    updateLinkCoordinates(
      linkCopy,
      winnerNodeId,
      targetNode.coordinates as [number, number],
      lengthUnit,
    );
    updatedLinks.push(linkCopy);

    processLinkCustomerPoints(
      linkCopy,
      winnerNode,
      assets,
      customerPointsLookup,
      updatedCustomerPoints,
    );
  }
};
