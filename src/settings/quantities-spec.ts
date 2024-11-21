import {
  canonicalQuantitiesSpec,
  AssetQuantitiesSpecByType,
} from "src/hydraulics/asset-types";

const USCustomarySpec: AssetQuantitiesSpecByType = {
  pipe: {
    diameter: { defaultValue: 12, unit: "in" },
    length: { defaultValue: 1000, unit: "ft" },
    roughnessDW: { defaultValue: 0.00015, unit: "ft" },
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
