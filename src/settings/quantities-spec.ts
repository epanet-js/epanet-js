import { Unit } from "src/quantity";
import { DefaultQuantities } from "src/hydraulic-model/asset-builder";
import { ModelUnits } from "src/hydraulic-model/units";
import { PipeQuantity } from "src/hydraulic-model/asset-types/pipe";
import { JunctionQuantity } from "src/hydraulic-model/asset-types/junction";
import { ReservoirQuantity } from "src/hydraulic-model/asset-types/reservoir";
import { isFeatureOn } from "src/infra/feature-flags";

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

const USCustomarySpec: AssetQuantitiesSpec = {
  pipe: {
    diameter: { defaultValue: 12, unit: "in" },
    length: { defaultValue: 1000, unit: "ft", decimals: 2 },
    roughness: { defaultValue: 130, unit: null },
    minorLoss: { defaultValue: 0, unit: null },
    flow: { defaultValue: 0, unit: "gal/min" },
  },
  junction: {
    elevation: { defaultValue: 0, unit: "ft" },
    demand: { defaultValue: 0, unit: "gal/min" },
    pressure: { defaultValue: 0, unit: "psi" },
  },
  reservoir: {
    elevation: { defaultValue: 0, unit: "ft" },
    head: { defaultValue: 0, unit: "ft" },
    relativeHead: { defaultValue: 32, unit: "ft" },
  },
};

const internationalSpec: AssetQuantitiesSpec = {
  pipe: {
    diameter: { defaultValue: 300, unit: "mm" },
    length: { defaultValue: 1000, unit: "m", decimals: 2 },
    roughness: { defaultValue: 130, unit: null }, //H-W
    minorLoss: { defaultValue: 0, unit: null },
    flow: { defaultValue: 0, unit: "l/s" },
  },
  junction: {
    elevation: { defaultValue: 0, unit: "m" },
    demand: {
      defaultValue: isFeatureOn("FLAG_DEFAULT_DEMAND") ? 1 : 0,
      unit: "l/s",
    },
    pressure: { defaultValue: 0, unit: "mwc" },
  },
  reservoir: {
    elevation: { defaultValue: 0, unit: "m" },
    relativeHead: { defaultValue: 10, unit: "m" },
    head: { defaultValue: 0, unit: "m" },
  },
};

export const presets = {
  si: internationalSpec,
  usCustomary: USCustomarySpec,
};

export class Quantities {
  public readonly defaults: DefaultQuantities;
  public readonly units: ModelUnits;
  private spec: AssetQuantitiesSpec;

  constructor(spec: AssetQuantitiesSpec) {
    this.spec = spec;
    this.defaults = this.buildDefaultQuantities(spec);
    this.units = this.buildModelUnits(spec);
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

  private buildModelUnits(spec: AssetQuantitiesSpec): ModelUnits {
    const result = { pipe: {}, junction: {}, reservoir: {} };
    for (const assetType in spec) {
      result[assetType as keyof AssetQuantitiesSpec] = this.mapUnits(
        spec,
        assetType as keyof AssetQuantitiesSpec,
      );
    }
    return result as ModelUnits;
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
