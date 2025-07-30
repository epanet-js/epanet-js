import { Asset, AssetsMap } from "src/hydraulic-model";
import { AssetType } from "src/hydraulic-model/asset-types";

export const getByLabel = (
  assets: AssetsMap,
  label: string,
): Asset | undefined => {
  return [...assets.values()].find((a) => a.label === label);
};

export const getAssetsByType = <T extends Asset>(
  assets: AssetsMap,
  type: AssetType,
  filterFn?: (asset: T) => boolean,
): T[] => {
  return [...assets.values()].filter(
    (asset) => asset.type === type && (!filterFn || filterFn(asset as T)),
  ) as T[];
};
