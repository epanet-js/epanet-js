import { Asset, AssetId, NodeAsset, LinkAsset, Pipe } from "./asset-types";

export type { AssetId };
export class AssetsMap extends Map<AssetId, Asset> {}

export const getPipe = (assets: AssetsMap, pipeId: AssetId): Pipe | null => {
  const asset = assets.get(pipeId);
  if (!asset || asset.type !== "pipe") return null;

  return asset as Pipe;
};

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

export const getLinkNodes = (
  assets: AssetsMap,
  link: LinkAsset,
): { startNode: NodeAsset | null; endNode: NodeAsset | null } => {
  const [startNodeId, endNodeId] = link.connections;
  const startNode = getNode(assets, startNodeId);
  const endNode = getNode(assets, endNodeId);
  return { startNode, endNode };
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
