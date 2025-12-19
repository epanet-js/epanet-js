import { AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { CustomerPoints } from "../customer-points";
import { Pipe } from "../asset-types/pipe";
import { Junction } from "../asset-types/junction";
import { HydraulicModel } from "../hydraulic-model";
import { AssetsMap } from "../assets-map";
import { Topology } from "../topology";
import { CustomerPointsLookup } from "../customer-points-lookup";
import { updateLinkConnections } from "../mutations/update-link-connections";
import { isNodeAsset } from "../asset-types/type-guards";
import { reassignCustomerPoints } from "../mutations/reassign-customer-points";

type InputData = {
  sourceNodeId: AssetId;
  targetNodeId: AssetId;
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

export const mergeNodes: ModelOperation<InputData> = (
  hydraulicModel,
  { sourceNodeId, targetNodeId },
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
  );

  const shouldBeActive = updatedLinks.length
    ? updatedLinks.some((link) => link.isActive)
    : true;
  mergedNode.setProperty("isActive", shouldBeActive);

  return buildMergeResult(
    mergedNode,
    loserNode,
    updatedLinks,
    updatedCustomerPoints,
  );
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
  loserNode: NodeAsset,
  targetNode: NodeAsset,
): NodeAsset => {
  const winnerNodeCopy = winnerNode.copy();
  winnerNodeCopy.setCoordinates(targetNode.coordinates);
  winnerNodeCopy.setElevation(targetNode.elevation);

  if (winnerNode.type === "junction" && loserNode.type === "junction") {
    const winnerJunction = winnerNodeCopy as Junction;
    const loserJunction = loserNode as Junction;

    const mergedDemands = [...winnerJunction.demands, ...loserJunction.demands];
    winnerJunction.setDemands(mergedDemands);
  }

  return winnerNodeCopy;
};

const updateLinkCoordinates = (
  link: LinkAsset,
  nodeId: AssetId,
  newCoordinates: [number, number],
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
): void => {
  const winnerConnectedLinkIds = topology.getLinks(winnerNodeId);

  for (const linkId of winnerConnectedLinkIds) {
    const link = assets.get(linkId) as LinkAsset;
    const linkCopy = link.copy();

    updateLinkCoordinates(
      linkCopy,
      winnerNodeId,
      targetNode.coordinates as [number, number],
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

const buildMergeResult = (
  winnerNode: NodeAsset,
  loserNode: NodeAsset,
  updatedLinks: LinkAsset[],
  updatedCustomerPoints: CustomerPoints,
) => {
  return {
    note: `Merge ${loserNode.type} into ${winnerNode.type}`,
    putAssets: [winnerNode, ...updatedLinks],
    deleteAssets: [loserNode.id],
    putCustomerPoints:
      updatedCustomerPoints.size > 0
        ? [...updatedCustomerPoints.values()]
        : undefined,
  };
};
