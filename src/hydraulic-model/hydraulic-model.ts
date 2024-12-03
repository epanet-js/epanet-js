import { Topology } from "./topology";
import { AssetsMap } from "./assets-map";
import { AssetBuilder } from "./asset-builder";
import {
  AssetQuantitiesSpecByType,
  canonicalQuantitiesSpec,
} from "./asset-types";

export type HydraulicModel = {
  version: string;
  assets: AssetsMap;
  assetBuilder: AssetBuilder;
  topology: Topology;
};

export { AssetsMap };

export const nullHydraulicModel = (
  assets: AssetsMap,
  quantitiesSpec: AssetQuantitiesSpecByType = canonicalQuantitiesSpec,
): HydraulicModel => {
  return {
    version: "0",
    assets,
    assetBuilder: new AssetBuilder(quantitiesSpec),
    topology: new Topology(),
  };
};
