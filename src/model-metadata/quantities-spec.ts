import { Unit } from "src/quantity";
import {
  HeadlossFormula,
  PipeQuantity,
} from "src/hydraulic-model/asset-types/pipe";
import { JunctionQuantity } from "src/hydraulic-model/asset-types/junction";
import { ReservoirQuantity } from "src/hydraulic-model/asset-types/reservoir";
import { EpanetUnitSystem } from "src/simulation/build-inp";
import { PumpQuantity } from "src/hydraulic-model/asset-types/pump";
import { ValveQuantity } from "src/hydraulic-model/asset-types/valve";
import { TankQuantity } from "src/hydraulic-model/asset-types/tank";

export type QuantityProperty =
  | "diameter"
  | "length"
  | "roughness"
  | "minorLoss"
  | "flow"
  | "velocity"
  | "elevation"
  | "baseDemand"
  | "directDemand"
  | "actualDemand"
  | "netFlow"
  | "customerDemand"
  | "customerDemandPerDay"
  | "emitterCoefficient"
  | "pressure"
  | "headloss"
  | "unitHeadloss"
  | "head"
  | "actualHead"
  | "power"
  | "speed"
  | "tcvSetting"
  | "initialLevel"
  | "minLevel"
  | "maxLevel"
  | "minVolume"
  | "level"
  | "volume"
  | "tankDiameter"
  | "tankArea"
  | "efficiency"
  | "averageKwPerFlowUnit";

export type UnitsSpec = Record<QuantityProperty, Unit>;
export type DecimalsSpec = Partial<Record<keyof UnitsSpec, number>>;
type DefaultsSpec = {
  pipe: Partial<Record<PipeQuantity, number>>;
  junction: Partial<Record<JunctionQuantity, number>>;
  reservoir: Partial<Record<ReservoirQuantity | "relativeHead", number>>;
  pump: Partial<Record<PumpQuantity, number>>;
  valve: Partial<Record<ValveQuantity, number>>;
  tank: Partial<Record<TankQuantity, number>>;
};

const defaultDecimals = 3;

export type AssetQuantitiesSpec = {
  id: string;
  name: string;
  descriptionKey: string;
  units: UnitsSpec;
  decimals: DecimalsSpec;
  defaults: DefaultsSpec;
  ranges: {
    velocityFallbackEndpoints: [number, number];
    unitHeadlossFallbackEndpoints: [number, number];
  };
};

const allFlowUnits = (unit: Unit) => ({
  flow: unit,
  baseDemand: unit,
  directDemand: unit,
  actualDemand: unit,
  netFlow: unit,
  emitterCoefficient: null as Unit,
});

const allLevelUnits = (unit: Unit) => ({
  initialLevel: unit,
  minLevel: unit,
  maxLevel: unit,
});

const metricSpec: AssetQuantitiesSpec = {
  id: "metric-spec",
  name: "",
  descriptionKey: "",
  units: {
    diameter: "mm",
    length: "m",
    roughness: null,
    minorLoss: null,
    velocity: "m/s",
    elevation: "m",
    pressure: "mwc",
    head: "m",
    actualHead: "m",
    headloss: "m",
    unitHeadloss: "m/km",
    power: "kW",
    speed: null,
    tcvSetting: null,
    minVolume: "m^3",
    level: "m",
    volume: "m^3",
    tankDiameter: "m",
    tankArea: "m^2",
    efficiency: "%",
    customerDemand: "l/s",
    customerDemandPerDay: "l/d",
    ...allLevelUnits("m"),
    ...allFlowUnits("l/s"),
    averageKwPerFlowUnit: "kW/m^3",
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
    tank: {
      diameter: 10,
      initialLevel: 10,
      minLevel: 0,
      maxLevel: 35,
      minVolume: 0,
    },
    pump: {
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
  descriptionKey: "",
  units: {
    diameter: "in",
    length: "ft",
    roughness: null,
    minorLoss: null,
    velocity: "ft/s",
    elevation: "ft",
    pressure: "psi",
    head: "ft",
    actualHead: "ft",
    headloss: "ft",
    unitHeadloss: "ft/kft",
    power: "hp",
    speed: null,
    tcvSetting: null,
    minVolume: "ft^3",
    level: "ft",
    volume: "ft^3",
    tankDiameter: "ft",
    tankArea: "ft^2",
    efficiency: "%",
    customerDemand: "gal/min",
    customerDemandPerDay: "gal/d",
    ...allLevelUnits("ft"),
    ...allFlowUnits("gal/min"),
    averageKwPerFlowUnit: "kW/Mgal",
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
    tank: {
      diameter: 120,
      initialLevel: 10,
      minLevel: 0,
      maxLevel: 30,
      minVolume: 0,
    },
    pump: {
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
  descriptionKey: "gpmDescription",
  units: {
    ...usCustomarySpec.units,
    customerDemand: "gal/min",
    ...allFlowUnits("gal/min"),
  },
};
const CFSSpec: AssetQuantitiesSpec = {
  ...usCustomarySpec,
  id: "cfs",
  name: "CFS",
  descriptionKey: "cfsDescription",
  units: {
    ...usCustomarySpec.units,
    customerDemand: "ft^3/s",
    ...allFlowUnits("ft^3/s"),
  },
};
const MGDSpec: AssetQuantitiesSpec = {
  ...usCustomarySpec,
  id: "mgd",
  name: "MGD",
  descriptionKey: "mgdDescription",
  units: {
    ...usCustomarySpec.units,
    customerDemand: "Mgal/d",
    ...allFlowUnits("Mgal/d"),
  },
};

const IMGDSpec: AssetQuantitiesSpec = {
  ...usCustomarySpec,
  id: "imgd",
  name: "IMGD",
  descriptionKey: "imgdDescription",
  units: {
    ...usCustomarySpec.units,
    customerDemand: "IMgal/d",
    ...allFlowUnits("IMgal/d"),
  },
};

const AFDSpec: AssetQuantitiesSpec = {
  ...usCustomarySpec,
  id: "afd",
  name: "AFD",
  descriptionKey: "afdDescription",
  units: {
    ...usCustomarySpec.units,
    customerDemand: "acft/d",
    ...allFlowUnits("acft/d"),
  },
};

const LPSSpec: AssetQuantitiesSpec = {
  ...metricSpec,
  id: "lps",
  name: "LPS",
  descriptionKey: "lpsDescription",
  units: {
    ...metricSpec.units,
    customerDemand: "l/s",
    ...allFlowUnits("l/s"),
  },
};
const LPMSpec: AssetQuantitiesSpec = {
  ...metricSpec,
  id: "lpm",
  name: "LPM",
  descriptionKey: "lpmDescription",
  units: {
    ...metricSpec.units,
    customerDemand: "l/min",
    ...allFlowUnits("l/min"),
  },
};
const MLDSpec: AssetQuantitiesSpec = {
  ...metricSpec,
  id: "mld",
  name: "MLD",
  descriptionKey: "mldDescription",
  units: {
    ...metricSpec.units,
    customerDemand: "Ml/d",
    ...allFlowUnits("Ml/d"),
  },
};
const CMHSpec: AssetQuantitiesSpec = {
  ...metricSpec,
  id: "cmh",
  name: "CMH",
  descriptionKey: "cmhDescription",
  units: {
    ...metricSpec.units,
    customerDemand: "m^3/h",
    ...allFlowUnits("m^3/h"),
  },
};
const CMDSpec: AssetQuantitiesSpec = {
  ...metricSpec,
  id: "cmd",
  name: "CMD",
  descriptionKey: "cmdDescription",
  units: {
    ...metricSpec.units,
    customerDemand: "m^3/d",
    ...allFlowUnits("m^3/d"),
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

export const supportedPressureUnits: Unit[] = [
  "psi",
  "kPa",
  "mwc",
  "fwc",
  "bar",
];

export const getDefaultPressureUnit = (presetKey: keyof Presets): Unit => {
  return presets[presetKey].units.pressure;
};

export const withPressureUnit = (
  spec: AssetQuantitiesSpec,
  pressureUnit: Unit,
): AssetQuantitiesSpec => {
  if (pressureUnit === spec.units.pressure) return spec;
  return { ...spec, units: { ...spec.units, pressure: pressureUnit } };
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

  get ranges() {
    return this.spec.ranges;
  }

  get units(): UnitsSpec {
    return this.spec.units;
  }

  getDecimals(name: keyof DecimalsSpec): number | undefined {
    const decimals = this.spec.decimals[name];
    if (decimals === undefined) return defaultDecimals;

    return decimals;
  }

  getMinorLossUnit(headlossFormula: HeadlossFormula): Unit {
    if (headlossFormula === "D-W") {
      return this.spec.units.length;
    } else {
      return null;
    }
  }

  withPressureUnit(pressureUnit: Unit): Quantities {
    return new Quantities(withPressureUnit(this.spec, pressureUnit));
  }
}
