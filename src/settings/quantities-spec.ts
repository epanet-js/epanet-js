import { canonicalQuantitiesSpec } from "src/hydraulic-model";
import { AssetQuantitiesSpec } from "src/hydraulic-model/quantities";

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

export const presets = {
  si: canonicalQuantitiesSpec,
  usCustomary: USCustomarySpec,
};
