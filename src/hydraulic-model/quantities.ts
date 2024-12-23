import { Unit } from "src/quantity";
import { JunctionQuantity } from "./asset-types/junction";
import { PipeQuantity } from "./asset-types/pipe";
import { ReservoirQuantity } from "./asset-types/reservoir";
import { DefaultQuantities } from "./asset-builder";

type QuantitySpec = {
  defaultValue: number;
  unit: Unit;
  decimals?: number;
};
export type AssetQuantitiesSpec = {
  pipe: Record<PipeQuantity, QuantitySpec>;
  junction: Record<JunctionQuantity, QuantitySpec>;
  reservoir: Record<ReservoirQuantity, QuantitySpec>;
};

export type AssetUnitsByType = {
  pipe: Record<PipeQuantity, Unit>;
  junction: Record<JunctionQuantity, Unit>;
  reservoir: Record<ReservoirQuantity, Unit>;
};

export class Quantities {
  public readonly defaults: DefaultQuantities;
  public readonly units: AssetUnitsByType;
  private spec: AssetQuantitiesSpec;

  constructor(spec: AssetQuantitiesSpec) {
    this.spec = spec;
    this.defaults = this.buildDefaultQuantities(spec);
    this.units = this.buildAssetUnitsByType(spec);
  }

  getUnit<T extends keyof AssetQuantitiesSpec>(
    assetType: T,
    name: keyof AssetQuantitiesSpec[T],
  ): Unit {
    return (this.spec[assetType][name] as QuantitySpec).unit;
  }

  getDefaultValue<T extends keyof AssetQuantitiesSpec>(
    assetType: T,
    name: keyof AssetQuantitiesSpec[T],
  ): number {
    return (this.spec[assetType][name] as QuantitySpec).defaultValue;
  }

  private buildAssetUnitsByType(spec: AssetQuantitiesSpec): AssetUnitsByType {
    const result = { pipe: {}, junction: {}, reservoir: {} };
    for (const assetType in spec) {
      result[assetType as keyof AssetQuantitiesSpec] = this.mapUnits(
        spec,
        assetType as keyof AssetQuantitiesSpec,
      );
    }
    return result as AssetUnitsByType;
  }

  private mapUnits<T extends keyof AssetQuantitiesSpec>(
    spec: AssetQuantitiesSpec,
    assetType: T,
  ): Record<string, Unit> {
    const result: Record<string, Unit> = {};
    for (const name in spec[assetType]) {
      result[name] = (
        spec[assetType][name as keyof AssetQuantitiesSpec[T]] as QuantitySpec
      ).unit;
    }
    return result;
  }

  private buildDefaultQuantities(spec: AssetQuantitiesSpec): DefaultQuantities {
    const result = { pipe: {}, junction: {}, reservoir: {} };
    for (const assetType in spec) {
      result[assetType as keyof AssetQuantitiesSpec] =
        this.mapDefaultQuantities(spec, assetType as keyof AssetQuantitiesSpec);
    }
    return result as DefaultQuantities;
  }

  private mapDefaultQuantities<T extends keyof AssetQuantitiesSpec>(
    spec: AssetQuantitiesSpec,
    assetType: T,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const name in spec[assetType]) {
      result[name] = (
        spec[assetType][name as keyof AssetQuantitiesSpec[T]] as QuantitySpec
      ).defaultValue;
    }
    return result;
  }
}
