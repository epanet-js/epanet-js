import { AssetId, Asset, Pipe } from "../asset-types";
import { ModelOperation } from "../model-operation";
import { CustomerPoint } from "../customer-points";

type InputData = {
  assetIds: readonly AssetId[];
  shouldUpdateCustomerPoints?: boolean;
};

export const deleteAssets: ModelOperation<InputData> = (
  { topology, assets, customerPointsLookup },
  { assetIds, shouldUpdateCustomerPoints = false },
) => {
  const affectedIds = new Set(assetIds);
  const disconnectedCustomerPoints = new Map<string, CustomerPoint>();

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

  return {
    note: "Delete assets",
    deleteAssets: Array.from(affectedIds),
    putCustomerPoints:
      shouldUpdateCustomerPoints && disconnectedCustomerPoints.size > 0
        ? Array.from(disconnectedCustomerPoints.values())
        : undefined,
  };
};

const addCustomerPointsToDisconnect = (
  asset: Asset | undefined,
  disconnectedCustomerPoints: Map<string, CustomerPoint>,
  customerPointsLookup: any,
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
