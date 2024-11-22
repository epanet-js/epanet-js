import {
  canonicalQuantitiesSpec,
  AssetQuantitiesSpecByType,
} from "src/hydraulics/asset-types";

const USCustomarySpec: AssetQuantitiesSpecByType = {
  pipe: {
    diameter: { defaultValue: 12, unit: "in" },
    length: { defaultValue: 1000, unit: "ft", decimals: 2 },
    roughnessDW: { defaultValue: 0.00015, unit: "ft" },
    roughnessHW: { defaultValue: 130, unit: null },
    roughnessCM: { defaultValue: 0.012, unit: null },
  },
  junction: {
    elevation: { defaultValue: 0, unit: "ft" },
    demand: { defaultValue: 0, unit: "gal/min" },
  },
};

export const presets = {
  si: canonicalQuantitiesSpec,
  usCustomary: USCustomarySpec,
};
