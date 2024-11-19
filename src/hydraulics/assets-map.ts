import { AssetType, AssetId, NodeType, LinkType } from "./asset-types";

export type { AssetId };
export class AssetsMap extends Map<AssetId, AssetType> {}

export const getLink = (
  assets: AssetsMap,
  assetId: AssetId,
): LinkType | null => {
  const asset = assets.get(assetId);
  if (!asset || !asset.isLink) return null;

  return asset as LinkType;
};

export const getNode = (
  assets: AssetsMap,
  assetId: AssetId,
): NodeType | null => {
  const asset = assets.get(assetId);
  if (!asset || !asset.isNode) return null;

  return asset as NodeType;
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
