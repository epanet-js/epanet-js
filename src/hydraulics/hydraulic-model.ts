import { FeatureMap } from "src/types";
import { Topology } from "./topology";

export type HydraulicModel = {
  assets: FeatureMap;
  topology: Topology;
};

export const nullHydraulicModel = (assets: FeatureMap): HydraulicModel => {
  return {
    assets,
    topology: new Topology(),
  };
};
