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

import {
  AssetQuantitiesSpec,
  QuantitySpec,
} from "src/hydraulics/asset-types/asset-quantities";
import { QuantityAttribute, StatusAttribute } from "./base-asset";
import { Unit } from "src/quantity";

export type AssetExplain = Record<
  "status" | keyof PipeQuantities | keyof JunctionQuantities,
  QuantityAttribute | StatusAttribute<AssetStatus>
>;

export type AssetQuantitiesSpecByType = Record<
  Asset["type"],
  AssetQuantitiesSpec<AssetQuantities>
>;

export const getUnitFromSpec = (
  spec: AssetQuantitiesSpecByType,
  assetType: Asset["type"],
  key: keyof AssetQuantities,
): Unit => {
  const assetSpec = spec[assetType];
  const quantitySpec = assetSpec[key];
  return (quantitySpec as QuantitySpec).unit;
};

export const canonicalQuantitiesSpec: AssetQuantitiesSpecByType = {
  pipe: pipeCanonicalSpec,
  junction: junctionCanonicalSpec,
};
