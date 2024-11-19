import { AssetType, AssetId, LinkAsset, NodeAsset } from "./asset-types";

export type { AssetId };
export type { NodeAsset };
export class AssetsMap extends Map<AssetId, AssetType> {}

export const getLink = (
  assets: AssetsMap,
  assetId: AssetId,
): LinkAsset | null => {
  const asset = assets.get(assetId);
  if (!asset || !asset.isLink) return null;

  return asset as LinkAsset;
};

export const getNode = (
  assets: AssetsMap,
  assetId: AssetId,
): NodeAsset | null => {
  const asset = assets.get(assetId);
  if (!asset || !asset.isNode) return null;

  return asset as NodeAsset;
};

export const filterAssets = (
  assets: AssetsMap,
  assetIds: Set<AssetId> | AssetId[],
): AssetsMap => {
  const resultAssets = new AssetsMap();
  for (const assetId of assetIds) {
    const asset = assets.get(assetId);
    if (!asset) continue;

    resultAssets.set(asset.id, asset);
  }
  return resultAssets;
};
