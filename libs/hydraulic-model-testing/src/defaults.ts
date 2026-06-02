import type { DefaultsSpec } from "@epanet-js/hydraulic-model";

// Fixed defaults for building assets in tests. Mirrors the production
// `presets.LPS.defaults` values so existing default-value assertions hold,
// but lives here so test helpers carry no dependency on the app's settings.
export const testDefaults: DefaultsSpec = {
  pipe: { diameter: 300, length: 1000, roughness: 130 },
  junction: {},
  reservoir: { relativeHead: 10 },
  tank: {
    diameter: 10,
    initialLevel: 10,
    minLevel: 0,
    maxLevel: 35,
    minVolume: 0,
  },
  pump: { power: 20 },
  valve: { diameter: 300 },
};
