import { FeatureMap } from "src/types";
import { Topology } from "./topology";
import { AssetsMap } from "./assets";

export type HydraulicModel = {
  assets: AssetsMap;
  topology: Topology;
};

export const nullHydraulicModel = (assets: FeatureMap): HydraulicModel => {
  return {
    assets,
    topology: new Topology(),
  };
};
