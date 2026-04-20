import { Position } from "geojson";

export type CanonicalProjection = { type: "wgs84"; id: string; name: string };

export type XYGridProjection = {
  type: "xy-grid";
  id: string;
  name: string;
  centroid: Position;
  scale?: number;
};

export type Proj4Projection = {
  type: "proj4";
  id: string;
  name: string;
  code: string;
  deprecated?: boolean;
};

export type Projection =
  | CanonicalProjection
  | XYGridProjection
  | Proj4Projection;

export const WGS84: CanonicalProjection = {
  type: "wgs84",
  id: "wgs84",
  name: "WGS 84",
};
