import { Topology } from "./topology";
import { AssetsMap } from "./assets-map";
import { AssetBuilder, DefaultQuantities } from "./asset-builder";
import { ModelUnits } from "./units";

export type HydraulicModel = {
  version: string;
  assets: AssetsMap;
  assetBuilder: AssetBuilder;
  topology: Topology;
  units: ModelUnits;
};

export { AssetsMap };

export const initializeHydraulicModel = ({
  units,
  defaults,
}: {
  units: ModelUnits;
  defaults: DefaultQuantities;
}) => {
  return {
    version: "0",
    assets: new Map(),
    assetBuilder: new AssetBuilder(units, defaults),
    topology: new Topology(),
    units,
  };
};
