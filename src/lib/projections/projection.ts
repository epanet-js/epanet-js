import { Position } from "geojson";

export type Projection = "wgs84" | "xy-grid" | (string & NonNullable<unknown>);

export type ProjectionConfig =
  | { type: "wgs84" }
  | { type: "xy-grid"; centroid: Position };
