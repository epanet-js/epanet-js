import { Topology } from "./topology";
import { AssetsMap } from "./assets-map";
import { AssetBuilder } from "./asset-builder";
import {
  AssetQuantitiesSpecByType,
  canonicalQuantitiesSpec,
} from "./asset-types";

export type HydraulicModel = {
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
    assets,
    assetBuilder: new AssetBuilder(quantitiesSpec),
    topology: new Topology(),
  };
};
