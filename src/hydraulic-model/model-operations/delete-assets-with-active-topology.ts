import { AssetId, Asset, Pipe, NodeAsset, LinkAsset } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { CustomerPoint } from "../customer-points";
import { CustomerPointsLookup } from "../customer-points-lookup";
import { HydraulicModel } from "../hydraulic-model";

type InputData = {
  assetIds: readonly AssetId[];
  shouldUpdateCustomerPoints?: boolean;
};

export const deleteAssetsWithActiveTopology: ModelOperation<InputData> = (
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

  const deactivatedNodes = getNodesToDeactivate(hydraulicModel, affectedIds);

  return {
    note: "Delete assets",
    deleteAssets: Array.from(affectedIds),
    putAssets: deactivatedNodes.length > 0 ? deactivatedNodes : undefined,
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

const getNodesToDeactivate = (
  hydraulicModel: HydraulicModel,
  deletedAssetIds: Set<AssetId>,
): NodeAsset[] => {
  const { topology, assets } = hydraulicModel;
  const nodesToDeactivate: NodeAsset[] = [];
  const maybeInactiveNodeIds = new Set<AssetId>();

  for (const assetId of deletedAssetIds) {
    const link = assets.get(assetId) as LinkAsset | undefined;
    if (!link || !link.isLink || !link.isActive) continue;

    for (const nodeId of link.connections) {
      if (!deletedAssetIds.has(nodeId)) maybeInactiveNodeIds.add(nodeId);
    }
  }

  for (const nodeId of maybeInactiveNodeIds) {
    const node = assets.get(nodeId);
    if (!node || node.isLink || !node.isActive) continue;

    const remainingConnectedLinkIds = topology
      .getLinks(nodeId)
      .filter((id) => !deletedAssetIds.has(id));

    if (remainingConnectedLinkIds.length === 0) continue;

    const hasOtherActiveLinks = remainingConnectedLinkIds.some((linkId) => {
      if (deletedAssetIds.has(linkId)) return false;
      const link = assets.get(linkId);
      return link && link.isActive;
    });

    if (!hasOtherActiveLinks) {
      const nodeCopy = node.copy() as NodeAsset;
      nodeCopy.setProperty("isActive", false);
      nodesToDeactivate.push(nodeCopy);
    }
  }

  return nodesToDeactivate;
};
