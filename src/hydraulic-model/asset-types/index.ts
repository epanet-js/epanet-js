import { Pipe, PipeQuantities, PipeStatus, pipeCanonicalSpec } from "./pipe";
import {
  Junction,
  JunctionQuantities,
  junctionCanonicalSpec,
} from "./junction";

export type Asset = Pipe | Junction | Reservoir;
export type AssetQuantities =
  | PipeQuantities
  | JunctionQuantities
  | ReservoirQuantities;
export type AssetStatus = PipeStatus;
export type NodeAsset = Junction | Reservoir;
export type LinkAsset = Pipe;

export { Pipe, Junction, Reservoir };
export type { AssetId } from "./base-asset";
export { BaseAsset } from "./base-asset";
export type { PipeProperties } from "./pipe";

import { QuantitiesSpec, QuantitySpec } from "src/quantity";
import {
  Reservoir,
  ReservoirQuantities,
  reservoirCanonicalSpec,
} from "./reservoir";

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
  reservoir: reservoirCanonicalSpec,
};
