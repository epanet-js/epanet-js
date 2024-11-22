import { Pipe, PipeQuantities, PipeStatus, pipeCanonicalSpec } from "./pipe";
import {
  Junction,
  JunctionQuantities,
  junctionCanonicalSpec,
} from "./junction";

export type Asset = Pipe | Junction;
export type AssetQuantities = PipeQuantities | JunctionQuantities;
export type AssetStatus = PipeStatus;
export type NodeAsset = Junction;
export type LinkAsset = Pipe;

export { Pipe, Junction };
export type { AssetId } from "./base-asset";

import { QuantityAttribute, StatusAttribute } from "./base-asset";
import { QuantitiesSpec, QuantitySpec } from "src/quantity";

export type AssetExplain = Record<
  "status" | keyof PipeQuantities | keyof JunctionQuantities,
  QuantityAttribute | StatusAttribute<AssetStatus>
>;

export type AssetQuantitiesSpecByType = Record<
  Asset["type"],
  QuantitiesSpec<AssetQuantities>
>;

export const getQuantitySpec = (
  systemSpec: AssetQuantitiesSpecByType,
  assetType: Asset["type"],
  key: keyof AssetQuantities,
): QuantitySpec => {
  const assetSpec = systemSpec[assetType];
  const quantitySpec = assetSpec[key];
  return quantitySpec;
};

export const canonicalQuantitiesSpec: AssetQuantitiesSpecByType = {
  pipe: pipeCanonicalSpec,
  junction: junctionCanonicalSpec,
};
