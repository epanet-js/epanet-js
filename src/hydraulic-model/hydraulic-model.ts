import { Topology } from "./topology";
import { AssetsMap } from "./assets-map";
import { AssetBuilder } from "./asset-builder";
import { canonicalQuantitiesSpec } from "./asset-types";
import { AssetQuantitiesSpec, ModelUnits, Quantities } from "./quantities";

export type HydraulicModel = {
  version: string;
  assets: AssetsMap;
  assetBuilder: AssetBuilder;
  topology: Topology;
  units: ModelUnits;
};

export { AssetsMap };

export const nullHydraulicModel = (
  assets: AssetsMap,
  quantitiesSpec: AssetQuantitiesSpec = canonicalQuantitiesSpec,
): HydraulicModel => {
  const quantities = new Quantities(quantitiesSpec);
  return {
    version: "0",
    assets,
    assetBuilder: new AssetBuilder(quantities.units, quantities.defaults),
    topology: new Topology(),
    units: quantities.units,
  };
};
