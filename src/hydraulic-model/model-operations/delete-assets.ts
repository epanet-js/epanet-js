import { AssetId, Asset, Pipe, NodeAsset, LinkAsset } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { CustomerPoint } from "../customer-points";
import { CustomerPointsLookup } from "../customer-points-lookup";
import { HydraulicModel } from "../hydraulic-model";
import { inferNodeIsActiveFromRemainingConnections } from "../utilities/active-topology";

type InputData = {
  assetIds: readonly AssetId[];
  shouldUpdateCustomerPoints?: boolean;
};

export const deleteAssets: ModelOperation<InputData> = (
  hydraulicModel,
  { assetIds, shouldUpdateCustomerPoints = false },
) => {
  const { topology, assets, customerPointsLookup } = hydraulicModel;
  const affectedIds = new Set(assetIds);
  const disconnectedCustomerPoints = new Map<number, CustomerPoint>();

  assetIds.forEach((id) => {
    if (shouldUpdateCustomerPoints) {
      const asset = assets.get(id);
      addCustomerPointsToDisconnect(
        asset,
        disconnectedCustomerPoints,
        customerPointsLookup,
      );
    }

    const maybeNodeId = id;
    topology.getLinks(maybeNodeId).forEach((linkId) => {
      affectedIds.add(linkId);
      if (shouldUpdateCustomerPoints) {
        const link = assets.get(linkId);
        addCustomerPointsToDisconnect(
          link,
          disconnectedCustomerPoints,
          customerPointsLookup,
        );
      }
    });
  });

  const boundaryNodes = reevaluateBoundaryNodes(hydraulicModel, affectedIds);

  return {
    note: "Delete assets",
    deleteAssets: Array.from(affectedIds),
    putAssets: boundaryNodes.length > 0 ? boundaryNodes : undefined,
    putCustomerPoints:
      shouldUpdateCustomerPoints && disconnectedCustomerPoints.size > 0
        ? Array.from(disconnectedCustomerPoints.values())
        : undefined,
  };
};

const addCustomerPointsToDisconnect = (
  asset: Asset | undefined,
  disconnectedCustomerPoints: Map<number, CustomerPoint>,
  customerPointsLookup: CustomerPointsLookup,
) => {
  if (!asset || asset.type !== "pipe") return;

  const pipe = asset as Pipe;
  const connectedCustomerPoints = customerPointsLookup.getCustomerPoints(
    pipe.id,
  );
  for (const customerPoint of connectedCustomerPoints) {
    if (!disconnectedCustomerPoints.has(customerPoint.id)) {
      const disconnectedCopy = customerPoint.copyDisconnected();
      disconnectedCustomerPoints.set(customerPoint.id, disconnectedCopy);
    }
  }
};

const reevaluateBoundaryNodes = (
  hydraulicModel: HydraulicModel,
  deletedAssetIds: Set<AssetId>,
): NodeAsset[] => {
  const { topology, assets } = hydraulicModel;
  const boundaryNodeIds = new Set<AssetId>();
  const boundaryNodes: NodeAsset[] = [];

  for (const assetId of deletedAssetIds) {
    const link = assets.get(assetId) as LinkAsset | undefined;
    if (!link || !link.isLink) continue;

    for (const nodeId of link.connections) {
      if (!deletedAssetIds.has(nodeId)) boundaryNodeIds.add(nodeId);
    }
  }

  for (const nodeId of boundaryNodeIds) {
    const node = assets.get(nodeId) as NodeAsset;
    if (!node || node.isLink) continue;
    const inferredState = inferNodeIsActiveFromRemainingConnections(
      node,
      deletedAssetIds,
      topology,
      assets,
    );

    if (inferredState !== node.isActive) {
      const nodeCopy = node.copy() as NodeAsset;
      nodeCopy.setProperty("isActive", inferredState);
      boundaryNodes.push(nodeCopy);
    }
  }

  return boundaryNodes;
};
