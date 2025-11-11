import { Asset, AssetId } from "../asset-types";
import { ModelOperation } from "../model-operation";

type InputData = {
  assetIds: AssetId[];
};

export const activateAssets: ModelOperation<InputData> = (
  { assets, topology },
  { assetIds },
) => {
  const updatedAssets: Map<AssetId, Asset> = new Map();

  for (const assetId of assetIds) {
    const asset = assets.get(assetId);
    if (!asset) throw new Error(`Invalid asset id ${assetId}`);

    if (!asset.isLink) continue;

    if (!asset.isActive) {
      updatedAssets.set(assetId, activateAsset(asset));
    }

    const [startNodeId, endNodeId] = topology.getNodes(assetId);

    const startNode = assets.get(startNodeId);
    if (!!startNode && !startNode?.isActive)
      updatedAssets.set(startNodeId, activateAsset(startNode));

    const endNode = assets.get(endNodeId);
    if (!!endNode && !endNode?.isActive)
      updatedAssets.set(endNodeId, activateAsset(endNode));
  }

  return {
    note: "Activate assets",
    putAssets: Array.from(updatedAssets.values()),
  };
};

const activateAsset = (asset: Asset): Asset => {
  const updated = asset.copy();
  updated.setProperty("isActive", true);
  return updated;
};
