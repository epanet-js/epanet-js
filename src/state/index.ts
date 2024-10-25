import { DEFAULT_MAP_BOUNDS } from "src/lib/constants";

export const DEFAULT_MAP_CENTER: Pos2 = [
  (DEFAULT_MAP_BOUNDS[0][0] + DEFAULT_MAP_BOUNDS[1][0]) / 2,
  (DEFAULT_MAP_BOUNDS[0][1] + DEFAULT_MAP_BOUNDS[1][1]) / 2,
];

export type { ModeOptions, ModeWithOptions } from "src/state/mode";
