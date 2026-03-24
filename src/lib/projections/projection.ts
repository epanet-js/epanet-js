import { Position } from "geojson";

export type Projection = {
  id: string;
  name: string;
  code?: string;
  deprecated?: boolean;
};

export const WGS84: Projection = { id: "wgs84", name: "WGS 84" };
export const XY_GRID: Projection = { id: "xy-grid", name: "XY Grid" };

export const projectionFromId = (id: string): Projection => {
  if (id === "wgs84") return WGS84;
  if (id === "xy-grid") return XY_GRID;
  return { id, name: id, code: id };
};

export type ProjectionConfig =
  | { type: "wgs84" }
  | { type: "xy-grid"; centroid: Position };
