import { Topology } from "./topology";
import { AssetsMap } from "./assets-map";
import { AssetBuilder, DefaultQuantities } from "./asset-builder";
import { UnitsSpec } from "src/model-metadata/quantities-spec";

export type HydraulicModel = {
  version: string;
  assets: AssetsMap;
  assetBuilder: AssetBuilder;
  topology: Topology;
  units: UnitsSpec;
};

export { AssetsMap };

export const initializeHydraulicModel = ({
  units,
  defaults,
}: {
  units: UnitsSpec;
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
