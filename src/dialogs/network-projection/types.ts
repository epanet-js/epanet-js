export type Projection = {
  id: string;
  name: string;
  code: string;
};

export type Bbox = [number, number, number, number];

export type ProjectionCandidate = {
  projection: Projection;
  projectedBbox: Bbox;
};
