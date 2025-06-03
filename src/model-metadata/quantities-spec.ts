import { Unit } from "src/quantity";
import {
  HeadlossFormula,
  PipeQuantity,
} from "src/hydraulic-model/asset-types/pipe";
import { JunctionQuantity } from "src/hydraulic-model/asset-types/junction";
import { ReservoirQuantity } from "src/hydraulic-model/asset-types/reservoir";
import { translate, translateUnit } from "src/infra/i18n";
import { EpanetUnitSystem } from "src/simulation/build-inp";
import { PumpQuantity } from "src/hydraulic-model/asset-types/pump";
import { ValveQuantity } from "src/hydraulic-model/asset-types/valve";

export type QuantityProperty =
  | "diameter"
  | "length"
  | "roughness"
  | "minorLoss"
  | "flow"
  | "velocity"
  | "elevation"
  | "baseDemand"
  | "pressure"
  | "headloss"
  | "unitHeadloss"
  | "head"
  | "power"
  | "speed"
  | "tcvSetting";

export type UnitsSpec = Record<QuantityProperty, Unit>;
export type DecimalsSpec = Partial<Record<keyof UnitsSpec, number>>;
type DefaultsSpec = {
  pipe: Partial<Record<PipeQuantity, number>>;
  junction: Partial<Record<JunctionQuantity, number>>;
  reservoir: Partial<Record<ReservoirQuantity | "relativeHead", number>>;
  pump: Partial<Record<PumpQuantity, number>>;
  valve: Partial<Record<ValveQuantity, number>>;
};

const defaultDecimals = 3;

export type AssetQuantitiesSpec = {
  id: string;
  name: string;
  description: string;
  units: UnitsSpec;
  decimals: DecimalsSpec;
  defaults: DefaultsSpec;
  ranges: {
    velocityFallbackEndpoints: [number, number];
    unitHeadlossFallbackEndpoints: [number, number];
  };
};

const metricSpec: AssetQuantitiesSpec = {
  id: "metric-spec",
  name: "",
  description: "",
  units: {
    diameter: "mm",
    length: "m",
    roughness: null,
    minorLoss: null,
    flow: "l/s",
    velocity: "m/s",
    elevation: "m",
    baseDemand: "l/s",
    pressure: "mwc",
    head: "m",
    headloss: "m",
    unitHeadloss: "m/km",
    power: "kW",
    speed: null,
    tcvSetting: null,
  },
  decimals: {},
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
    pump: {
      designHead: 1,
      designFlow: 1,
      power: 20,
    },
    valve: { diameter: 300 },
  },
  ranges: {
    velocityFallbackEndpoints: [0, 4],
    unitHeadlossFallbackEndpoints: [0, 5],
  },
};

const usCustomarySpec: AssetQuantitiesSpec = {
  id: "us-customary",
  name: "",
  description: "",
  units: {
    diameter: "in",
    length: "ft",
    roughness: null,
    minorLoss: null,
    flow: "gal/min",
    velocity: "ft/s",
    elevation: "ft",
    baseDemand: "gal/min",
    pressure: "psi",
    head: "ft",
    headloss: "ft",
    unitHeadloss: "ft/kft",
    power: "hp",
    speed: null,
    tcvSetting: null,
  },
  decimals: {
    elevation: 1,
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
    pump: {
      designHead: 1,
      designFlow: 1,
      power: 20,
    },
    valve: { diameter: 12 },
  },
  ranges: {
    velocityFallbackEndpoints: [0, 10],
    unitHeadlossFallbackEndpoints: [3, 12],
  },
};

const GPMSpec: AssetQuantitiesSpec = {
  ...usCustomarySpec,
  id: "gpm",
  name: "GPM",
  description: translate("usCustomaryFlowsExpressed", translateUnit("gal/min")),
  units: {
    ...usCustomarySpec.units,
    flow: "gal/min",
    baseDemand: "gal/min",
  },
};
const CFSSpec: AssetQuantitiesSpec = {
  ...usCustomarySpec,
  id: "cfs",
  name: "CFS",
  description: translate("usCustomaryFlowsExpressed", translateUnit("ft^3/s")),
  units: {
    ...usCustomarySpec.units,
    flow: "ft^3/s",
    baseDemand: "ft^3/s",
  },
};
const MGDSpec: AssetQuantitiesSpec = {
  ...usCustomarySpec,
  id: "mgd",
  name: "MGD",
  description: translate("usCustomaryFlowsExpressed", translateUnit("Mgal/d")),
  units: {
    ...usCustomarySpec.units,
    flow: "Mgal/d",
    baseDemand: "Mgal/d",
  },
};

const IMGDSpec: AssetQuantitiesSpec = {
  ...usCustomarySpec,
  id: "imgd",
  name: "IMGD",
  description: translate("usCustomaryFlowsExpressed", translateUnit("IMgal/d")),
  units: {
    ...usCustomarySpec.units,
    flow: "IMgal/d",
    baseDemand: "IMgal/d",
  },
};

const AFDSpec: AssetQuantitiesSpec = {
  ...usCustomarySpec,
  id: "afd",
  name: "AFD",
  description: translate("usCustomaryFlowsExpressed", translateUnit("acft/d")),
  units: {
    ...usCustomarySpec.units,
    flow: "acft/d",
    baseDemand: "acft/d",
  },
};

const LPSSpec: AssetQuantitiesSpec = {
  ...metricSpec,
  id: "lps",
  name: "LPS",
  description: translate("siFlowsExpressed", translateUnit("l/s")),
  units: {
    ...metricSpec.units,
    flow: "l/s",
    baseDemand: "l/s",
  },
};
const LPMSpec: AssetQuantitiesSpec = {
  ...metricSpec,
  id: "lpm",
  name: "LPM",
  description: translate("siFlowsExpressed", translateUnit("l/min")),
  units: {
    ...metricSpec.units,
    flow: "l/min",
    baseDemand: "l/min",
  },
};
const MLDSpec: AssetQuantitiesSpec = {
  ...metricSpec,
  id: "mld",
  name: "MLD",
  description: translate("siFlowsExpressed", translateUnit("Ml/d")),
  units: {
    ...metricSpec.units,
    flow: "Ml/d",
    baseDemand: "Ml/d",
  },
};
const CMHSpec: AssetQuantitiesSpec = {
  ...metricSpec,
  id: "cmh",
  name: "CMH",
  description: translate("siFlowsExpressed", translateUnit("m^3/h")),
  units: {
    ...metricSpec.units,
    flow: "m^3/h",
    baseDemand: "m^3/h",
  },
};
const CMDSpec: AssetQuantitiesSpec = {
  ...metricSpec,
  id: "cmd",
  name: "CMD",
  description: translate("siFlowsExpressed", translateUnit("m^3/d")),
  units: {
    ...metricSpec.units,
    flow: "m^3/d",
    baseDemand: "m^3/d",
  },
};

export type Presets = Record<EpanetUnitSystem, AssetQuantitiesSpec>;
export const presets: Presets = {
  LPS: LPSSpec,
  LPM: LPMSpec,
  MLD: MLDSpec,
  CMH: CMHSpec,
  CMD: CMDSpec,
  GPM: GPMSpec,
  CFS: CFSSpec,
  MGD: MGDSpec,
  IMGD: IMGDSpec,
  AFD: AFDSpec,
};

export class Quantities {
  private spec: AssetQuantitiesSpec;

  constructor(spec: AssetQuantitiesSpec) {
    this.spec = spec;
  }

  get specName() {
    return this.spec.name;
  }

  get defaults() {
    return this.spec.defaults;
  }

  get units() {
    return this.spec.units;
  }

  get ranges() {
    return this.spec.ranges;
  }

  getDecimals(name: keyof DecimalsSpec): number | undefined {
    const decimals = this.spec.decimals[name];
    if (decimals === undefined) return defaultDecimals;

    return decimals;
  }

  getUnit(name: keyof UnitsSpec): Unit {
    return this.spec.units[name];
  }

  getMinorLossUnit(headlossFormula: HeadlossFormula): Unit {
    if (headlossFormula === "D-W") {
      return this.getUnit("length");
    } else {
      return null;
    }
  }
}
