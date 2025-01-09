import { Unit } from "src/quantity";
import { PipeQuantity } from "src/hydraulic-model/asset-types/pipe";
import { JunctionQuantity } from "src/hydraulic-model/asset-types/junction";
import { ReservoirQuantity } from "src/hydraulic-model/asset-types/reservoir";

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
};

export const presets = {
  si: internationalSpec,
  usCustomary: USCustomarySpec,
};

export class Quantities {
  private spec: AssetQuantitiesSpec;

  constructor(spec: AssetQuantitiesSpec) {
    this.spec = spec;
  }

  get defaults() {
    return this.spec.defaults;
  }

  get units() {
    return this.spec.units;
  }

  getDecimals(name: keyof DecimalsSpec): number | undefined {
    return this.spec.decimals[name];
  }

  getUnit(name: keyof UnitsSpec): Unit {
    return this.spec.units[name];
  }
}
