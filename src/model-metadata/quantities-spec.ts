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
  | "velocity"
  | "elevation"
  | "demand"
  | "pressure"
  | "head",
  Unit
>;
export type DecimalsSpec = Partial<Record<keyof UnitsSpec, number>>;
type DefaultsSpec = {
  pipe: Partial<Record<PipeQuantity, number>>;
  junction: Partial<Record<JunctionQuantity, number>>;
  reservoir: Partial<Record<ReservoirQuantity | "relativeHead", number>>;
};
export type AssetQuantitiesSpec = {
  id: string;
  name: string;
  units: UnitsSpec;
  decimals: DecimalsSpec;
  defaults: DefaultsSpec;
  analysis: { velocitySteps: number[] };
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
    velocity: "ft/s",
    elevation: "ft",
    demand: "gal/min",
    pressure: "psi",
    head: "ft",
  },
  decimals: {
    flow: 3,
    pressure: 3,
    velocity: 3,
  },
  defaults: {
    pipe: {
      diameter: 12,
      length: 1000,
      roughness: 130,
    },
    junction: {},
    reservoir: {
      relativeHead: 32,
    },
  },
  analysis: {
    velocitySteps: [0, 2.5, 5, 7.5, 10],
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
    velocity: "m/s",
    elevation: "m",
    demand: "l/s",
    pressure: "mwc",
    head: "m",
  },
  decimals: {
    flow: 3,
    pressure: 3,
    velocity: 3,
  },
  defaults: {
    pipe: {
      diameter: 300,
      length: 1000,
      roughness: 130,
    },
    junction: {},
    reservoir: {
      relativeHead: 10,
    },
  },
  analysis: {
    velocitySteps: [0, 1, 2, 3, 4],
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

  get analysis() {
    return this.spec.analysis;
  }

  getDecimals(name: keyof DecimalsSpec): number | undefined {
    return this.spec.decimals[name];
  }

  getUnit(name: keyof UnitsSpec): Unit {
    return this.spec.units[name];
  }
}
