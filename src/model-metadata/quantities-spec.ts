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
  id: string;
  name: string;
  mappings: {
    pipe: Record<PipeQuantity, QuantitySpec>;
    junction: Record<JunctionQuantity, QuantitySpec>;
    reservoir: Record<ReservoirQuantity, QuantitySpec>;
  };
};

const USCustomarySpec: AssetQuantitiesSpec = {
  id: "gpm",
  name: "GPM",
  mappings: {
    pipe: {
      diameter: { defaultValue: 12, unit: "in" },
      length: {
        defaultValue: 1000,
        unit: "ft",
        decimals: isFeatureOn("FLAG_MULTI_ASSETS") ? undefined : 2,
      },
      roughness: { defaultValue: 130, unit: null },
      minorLoss: { defaultValue: 0, unit: null },
      flow: {
        defaultValue: 0,
        unit: "gal/min",
        decimals: isFeatureOn("FLAG_MULTI_ASSETS") ? 3 : undefined,
      },
    },
    junction: {
      elevation: { defaultValue: 0, unit: "ft" },
      demand: { defaultValue: 0, unit: "gal/min" },
      pressure: {
        defaultValue: 0,
        unit: "psi",
        decimals: isFeatureOn("FLAG_MULTI_ASSETS") ? 3 : undefined,
      },
    },
    reservoir: {
      elevation: { defaultValue: 0, unit: "ft" },
      head: { defaultValue: 0, unit: "ft" },
      relativeHead: { defaultValue: 32, unit: "ft" },
    },
  },
};

const internationalSpec: AssetQuantitiesSpec = {
  id: "si",
  name: "SI",
  mappings: {
    pipe: {
      diameter: { defaultValue: 300, unit: "mm" },
      length: {
        defaultValue: 1000,
        unit: "m",
        decimals: isFeatureOn("FLAG_MULTI_ASSETS") ? undefined : 2,
      },
      roughness: { defaultValue: 130, unit: null }, //H-W
      minorLoss: { defaultValue: 0, unit: null },
      flow: {
        defaultValue: 0,
        unit: "l/s",
        decimals: isFeatureOn("FLAG_MULTI_ASSETS") ? 3 : undefined,
      },
    },
    junction: {
      elevation: { defaultValue: 0, unit: "m" },
      demand: {
        defaultValue: 0,
        unit: "l/s",
      },
      pressure: {
        defaultValue: 0,
        unit: "mwc",
        decimals: isFeatureOn("FLAG_MULTI_ASSETS") ? 3 : undefined,
      },
    },
    reservoir: {
      elevation: { defaultValue: 0, unit: "m" },
      relativeHead: { defaultValue: 10, unit: "m" },
      head: { defaultValue: 0, unit: "m" },
    },
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

  getDecimals<T extends keyof AssetQuantitiesSpec["mappings"]>(
    assetType: T,
    name: keyof AssetQuantitiesSpec["mappings"][T],
  ): number | undefined {
    return (this.spec.mappings[assetType][name] as QuantitySpec).decimals;
  }

  getUnit<T extends keyof AssetQuantitiesSpec["mappings"]>(
    assetType: T,
    name: keyof AssetQuantitiesSpec["mappings"][T],
  ): Unit {
    return (this.spec.mappings[assetType][name] as QuantitySpec).unit;
  }

  getDefaultUnit(name: string): Unit {
    for (const type of Object.keys(this.spec.mappings)) {
      const assetType = type as keyof AssetQuantitiesSpec["mappings"];
      for (const propName of Object.keys(this.spec.mappings[assetType])) {
        if (propName !== name) continue;

        // @ts-expect-error the key for sure exists
        return (this.spec.mappings[assetType][propName] as QuantitySpec).unit;
      }
    }
    return null;
  }

  getDefaultValue<T extends keyof AssetQuantitiesSpec["mappings"]>(
    assetType: T,
    name: keyof AssetQuantitiesSpec["mappings"][T],
  ): number {
    return (this.spec.mappings[assetType][name] as QuantitySpec).defaultValue;
  }

  private buildModelUnits(spec: AssetQuantitiesSpec): ModelUnits {
    const result = { pipe: {}, junction: {}, reservoir: {} };
    for (const assetType in spec.mappings) {
      result[assetType as keyof AssetQuantitiesSpec["mappings"]] =
        this.mapUnits(spec, assetType as keyof AssetQuantitiesSpec["mappings"]);
    }
    return result as ModelUnits;
  }

  private mapUnits<T extends keyof AssetQuantitiesSpec["mappings"]>(
    spec: AssetQuantitiesSpec,
    assetType: T,
  ): Record<string, Unit> {
    const result: Record<string, Unit> = {};
    for (const name in spec.mappings[assetType]) {
      result[name] = (
        spec.mappings[assetType][
          name as keyof AssetQuantitiesSpec["mappings"][T]
        ] as QuantitySpec
      ).unit;
    }
    return result;
  }

  private buildDefaultQuantities(spec: AssetQuantitiesSpec): DefaultQuantities {
    const result = { pipe: {}, junction: {}, reservoir: {} };
    for (const assetType in spec.mappings) {
      result[assetType as keyof AssetQuantitiesSpec["mappings"]] =
        this.mapDefaultQuantities(
          spec,
          assetType as keyof AssetQuantitiesSpec["mappings"],
        );
    }
    return result as DefaultQuantities;
  }

  private mapDefaultQuantities<T extends keyof AssetQuantitiesSpec["mappings"]>(
    spec: AssetQuantitiesSpec,
    assetType: T,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const name in spec.mappings[assetType]) {
      result[name] = (
        spec.mappings[assetType][
          name as keyof AssetQuantitiesSpec["mappings"][T]
        ] as QuantitySpec
      ).defaultValue;
    }
    return result;
  }
}
