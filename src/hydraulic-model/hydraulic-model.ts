import { Topology } from "./topology";
import { AssetsMap } from "./assets-map";
import { AssetBuilder } from "./asset-builder";
import { AssetQuantitiesSpec, ModelUnits, Quantities } from "./quantities";

export type HydraulicModel = {
  version: string;
  assets: AssetsMap;
  assetBuilder: AssetBuilder;
  topology: Topology;
  units: ModelUnits;
};

export { AssetsMap };

export const createHydraulicModel = (quantitiesSpec: AssetQuantitiesSpec) => {
  const quantities = new Quantities(quantitiesSpec);
  return {
    version: "0",
    assets: new Map(),
    assetBuilder: new AssetBuilder(quantities.units, quantities.defaults),
    topology: new Topology(),
    units: quantities.units,
  };
};
