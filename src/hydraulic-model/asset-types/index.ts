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

import { QuantitySpec, Unit } from "src/quantity";
import {
  Reservoir,
  ReservoirQuantities,
  reservoirCanonicalSpec,
} from "./reservoir";
import { AssetQuantitiesSpec } from "../quantities";

export type AssetQuantityKeys =
  | keyof PipeQuantities
  | keyof ReservoirQuantities
  | keyof JunctionQuantities;

export const getQuantitySpec = (
  systemSpec: AssetQuantitiesSpec,
  assetType: Asset["type"],
  key: keyof AssetQuantities,
): QuantitySpec => {
  const assetSpec = systemSpec[assetType];
  const quantitySpec = assetSpec[key];
  return quantitySpec;
};

export const canonicalQuantitiesSpec: AssetQuantitiesSpec = {
  pipe: pipeCanonicalSpec,
  junction: junctionCanonicalSpec,
  reservoir: reservoirCanonicalSpec,
};

export const getQuantityUnit = (
  systemSpec: AssetQuantitiesSpec,
  assetType: Asset["type"],
  key: AssetQuantityKeys,
): Unit => {
  const assetSpec = systemSpec[assetType];
  const quantitySpec = assetSpec[key as keyof AssetQuantities];
  if (!quantitySpec) {
    throw new Error(`Unit ${key} is not defined for ${assetType}`);
  }
  return (quantitySpec as QuantitySpec).unit;
};

type UnitRecord = Record<string, Unit>;
export const getUnitsByAsset = (
  systemSpec: AssetQuantitiesSpec,
): Record<Asset["type"], UnitRecord> => {
  const result: Record<Asset["type"], UnitRecord> = {
    pipe: {},
    junction: {},
    reservoir: {},
  };
  for (const assetType in systemSpec) {
    const assetQuantitiesSpec = systemSpec[assetType as Asset["type"]];

    for (const name in assetQuantitiesSpec) {
      result[assetType as Asset["type"]][name as keyof AssetQuantities] = (
        assetQuantitiesSpec[name as keyof AssetQuantities] as QuantitySpec
      ).unit;
    }
  }
  return result;
};
