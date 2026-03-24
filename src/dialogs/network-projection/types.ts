import type { Projection } from "src/lib/projections";

export type Bbox = [number, number, number, number];

export type ProjectionCandidate = {
  projection: Projection;
  projectedBbox: Bbox;
};
