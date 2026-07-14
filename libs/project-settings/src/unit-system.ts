export const epanetUnitSystems = [
  "LPS",
  "GPM",
  "CFS",
  "LPM",
  "MGD",
  "MLD",
  "IMGD",
  "CMH",
  "AFD",
  "CMD",
] as const;

export type EpanetUnitSystem = (typeof epanetUnitSystems)[number];
