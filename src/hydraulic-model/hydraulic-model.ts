import { Topology } from "./topology";
import { AssetsMap } from "./assets-map";
import { AssetBuilder } from "./asset-builder";
import { isFeatureOn } from "src/infra/feature-flags";
import { presets } from "src/settings/quantities-spec";

export type HydraulicModel = {
  assets: AssetsMap;
  assetBuilder: AssetBuilder;
  topology: Topology;
};

export { AssetsMap };

export const nullHydraulicModel = (assets: AssetsMap): HydraulicModel => {
  return {
    assets,
    assetBuilder: new AssetBuilder(
      isFeatureOn("FLAG_US_CUSTOMARY") ? presets.usCustomary : presets.si,
    ),
    topology: new Topology(),
  };
};
