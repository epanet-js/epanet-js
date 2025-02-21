import { Unit } from "src/quantity";
import {
  HeadlossFormula,
  PipeQuantity,
} from "src/hydraulic-model/asset-types/pipe";
import { JunctionQuantity } from "src/hydraulic-model/asset-types/junction";
import { ReservoirQuantity } from "src/hydraulic-model/asset-types/reservoir";
import { translate, translateUnit } from "src/infra/i18n";
import { isFeatureOn } from "src/infra/feature-flags";

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
  description: string;
  units: UnitsSpec;
  decimals: DecimalsSpec;
  defaults: DefaultsSpec;
  analysis: { velocitySteps: number[] };
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
    demand: "gal/min",
    pressure: "psi",
    head: "ft",
  },
  decimals: {
    flow: 3,
    pressure: 3,
    velocity: 3,
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
  },
  analysis: {
    velocitySteps: [0, 2.5, 5, 7.5, 10],
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
  },
};

type Presets = { [id: AssetQuantitiesSpec["id"]]: AssetQuantitiesSpec };
const deprecatedPresets: Presets = {
  lps: LPSSpec,
  gpm: GPMSpec,
};
const newPresets: Presets = {
  lps: LPSSpec,
  lpm: LPMSpec,
  mld: MLDSpec,
  gpm: GPMSpec,
  cfs: CFSSpec,
  mgd: MGDSpec,
};
export const presets = isFeatureOn("FLAG_EPANET_UNITS")
  ? newPresets
  : deprecatedPresets;

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

  get analysis() {
    return this.spec.analysis;
  }

  getDecimals(name: keyof DecimalsSpec): number | undefined {
    return this.spec.decimals[name];
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
