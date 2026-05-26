import type { Proj4Projection } from "src/lib/projections";

export type Bbox = [number, number, number, number];

export type ProjectionCandidate = {
  projection: Proj4Projection;
  projectedBbox: Bbox;
};
