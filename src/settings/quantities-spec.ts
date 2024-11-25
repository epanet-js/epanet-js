import {
  canonicalQuantitiesSpec,
  AssetQuantitiesSpecByType,
} from "src/hydraulics/asset-types";

const USCustomarySpec: AssetQuantitiesSpecByType = {
  pipe: {
    diameter: { defaultValue: 12, unit: "in" },
    length: { defaultValue: 1000, unit: "ft", decimals: 2 },
    roughness: { defaultValue: 130, unit: null },
  },
  junction: {
    elevation: { defaultValue: 0, unit: "ft" },
    demand: { defaultValue: 0, unit: "gal/min" },
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
