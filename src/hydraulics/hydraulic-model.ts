import { Topology } from "./topology";
import { AssetsMap } from "./assets";

export type HydraulicModel = {
  assets: AssetsMap;
  topology: Topology;
};

export { AssetsMap };

export const nullHydraulicModel = (assets: AssetsMap): HydraulicModel => {
  return {
    assets,
    topology: new Topology(),
  };
};
