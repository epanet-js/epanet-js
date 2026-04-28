export type CustomerPointRow = {
  id: number;
  label: string;
  coord_x: number;
  coord_y: number;
  pipe_id: number | null;
  junction_id: number | null;
  snap_x: number | null;
  snap_y: number | null;
};

export type CustomerPointDemandRow = {
  customer_point_id: number;
  ordinal: number;
  base_demand: number;
  pattern_id: number | null;
};

export type CustomerPointsData = {
  customerPoints: CustomerPointRow[];
  demands: CustomerPointDemandRow[];
};
