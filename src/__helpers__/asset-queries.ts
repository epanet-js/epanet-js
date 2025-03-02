import { Asset, AssetsMap } from "src/hydraulic-model";

export const getByLabel = (
  assets: AssetsMap,
  label: string,
): Asset | undefined => {
  return [...assets.values()].find((a) => a.label === label);
};
