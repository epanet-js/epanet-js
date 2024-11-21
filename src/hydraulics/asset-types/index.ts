import { Pipe, PipeExplain, PipeQuantities, pipeQuantitiesSpec } from "./pipe";
import {
  Junction,
  JunctionExplain,
  JunctionQuantities,
  junctionQuantitiesSpec,
} from "./junction";

export type Asset = Pipe | Junction;
export type AssetExplain = PipeExplain | JunctionExplain;
type AssetQuantities = PipeQuantities | JunctionQuantities;
export type NodeAsset = Junction;
export type LinkAsset = Pipe;

export { Pipe, Junction };
export type { AssetId } from "./base-asset";

import { AssetQuantitiesSpec } from "src/hydraulics/asset-types/asset-quantities";

export type AssetQuantitiesSpecByType = Record<
  Asset["type"],
  AssetQuantitiesSpec<AssetQuantities>
>;

export const canonicalQuantitiesSpec: AssetQuantitiesSpecByType = {
  pipe: pipeQuantitiesSpec,
  junction: junctionQuantitiesSpec,
};
