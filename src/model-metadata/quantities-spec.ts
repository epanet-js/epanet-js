import { Unit } from "src/quantity";
import { ModelUnits } from "src/hydraulic-model/units";
import { PipeQuantity } from "src/hydraulic-model/asset-types/pipe";
import { JunctionQuantity } from "src/hydraulic-model/asset-types/junction";
import { ReservoirQuantity } from "src/hydraulic-model/asset-types/reservoir";

type QuantitySpec = {
  defaultValue: number;
  unit: Unit;
};
export type UnitsSpec = Record<
  | "diameter"
  | "length"
  | "roughness"
  | "minorLoss"
  | "flow"
  | "elevation"
  | "demand"
  | "pressure"
  | "head"
  | "relativeHead",
  Unit
>;
type DecimalsSpec = Partial<Record<keyof UnitsSpec, number>>;
type DefaultsSpec = {
  pipe: Record<PipeQuantity, number>;
  junction: Record<JunctionQuantity, number>;
  reservoir: Record<ReservoirQuantity, number>;
};
export type AssetQuantitiesSpec = {
  id: string;
  name: string;
  units: UnitsSpec;
  decimals: DecimalsSpec;
  defaults: DefaultsSpec;
  mappings: {
    pipe: Record<PipeQuantity, QuantitySpec>;
    junction: Record<JunctionQuantity, QuantitySpec>;
    reservoir: Record<ReservoirQuantity, QuantitySpec>;
  };
};

const USCustomarySpec: AssetQuantitiesSpec = {
  id: "gpm",
  name: "GPM",
  units: {
    diameter: "in",
    length: "ft",
    roughness: null,
    minorLoss: null,
    flow: "gal/min",
    elevation: "ft",
    demand: "gal/min",
    pressure: "psi",
    head: "ft",
    relativeHead: "ft",
  },
  decimals: {
    flow: 3,
    pressure: 3,
  },
  defaults: {
    pipe: {
      diameter: 12,
      length: 1000,
      roughness: 130,
      minorLoss: 0,
      flow: 0,
    },
    junction: {
      elevation: 0,
      demand: 0,
      pressure: 0,
    },
    reservoir: {
      elevation: 0,
      head: 0,
      relativeHead: 32,
    },
  },
  mappings: {
    pipe: {
      diameter: { defaultValue: 12, unit: "in" },
      length: {
        defaultValue: 1000,
        unit: "ft",
      },
      roughness: { defaultValue: 130, unit: null },
      minorLoss: { defaultValue: 0, unit: null },
      flow: {
        defaultValue: 0,
        unit: "gal/min",
      },
    },
    junction: {
      elevation: { defaultValue: 0, unit: "ft" },
      demand: { defaultValue: 0, unit: "gal/min" },
      pressure: {
        defaultValue: 0,
        unit: "psi",
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
  units: {
    diameter: "mm",
    length: "m",
    roughness: null,
    minorLoss: null,
    flow: "l/s",
    elevation: "m",
    demand: "l/s",
    pressure: "mwc",
    head: "m",
    relativeHead: "m",
  },
  decimals: {
    flow: 3,
    pressure: 3,
  },
  defaults: {
    pipe: {
      diameter: 300,
      length: 1000,
      roughness: 130,
      minorLoss: 0,
      flow: 0,
    },
    junction: {
      elevation: 0,
      demand: 0,
      pressure: 0,
    },
    reservoir: {
      elevation: 0,
      relativeHead: 10,
      head: 0,
    },
  },
  mappings: {
    pipe: {
      diameter: { defaultValue: 300, unit: "mm" },
      length: {
        defaultValue: 1000,
        unit: "m",
      },
      roughness: { defaultValue: 130, unit: null }, //H-W
      minorLoss: { defaultValue: 0, unit: null },
      flow: {
        defaultValue: 0,
        unit: "l/s",
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
  public readonly units: ModelUnits;
  private spec: AssetQuantitiesSpec;

  constructor(spec: AssetQuantitiesSpec) {
    this.spec = spec;
    this.units = this.buildModelUnits(spec);
  }

  get defaults() {
    return this.spec.defaults;
  }

  getDecimals(name: keyof DecimalsSpec): number | undefined {
    return this.spec.decimals[name];
  }

  getUnit(name: keyof UnitsSpec): Unit {
    return this.spec.units[name];
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
}
