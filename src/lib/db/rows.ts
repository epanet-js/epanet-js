import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";

type NodeRowShared = {
  id: AssetId;
  type: string;
  label: string | null;
  is_active: number;
  coord_x: number;
  coord_y: number;
  elevation: number | null;
  initial_quality: number | null;
  chemical_source_type: string | null;
  chemical_source_strength: number | null;
  chemical_source_pattern_id: number | null;
};

type LinkRowShared = {
  id: AssetId;
  type: string;
  label: string | null;
  is_active: number;
  start_node_id: AssetId;
  end_node_id: AssetId;
  coords: string;
  length: number | null;
  initial_status: string | null;
};

export type JunctionRow = NodeRowShared & {
  emitter_coefficient: number | null;
};

export type ReservoirRow = NodeRowShared & {
  head: number | null;
  head_pattern_id: number | null;
};

export type TankRow = NodeRowShared & {
  initial_level: number | null;
  min_level: number | null;
  max_level: number | null;
  min_volume: number | null;
  diameter: number | null;
  overflow: number | null;
  mixing_model: string | null;
  mixing_fraction: number | null;
  bulk_reaction_coeff: number | null;
  volume_curve_id: number | null;
};

export type PipeRow = LinkRowShared & {
  diameter: number | null;
  roughness: number | null;
  minor_loss: number | null;
  bulk_reaction_coeff: number | null;
  wall_reaction_coeff: number | null;
};

export type PumpRow = LinkRowShared & {
  definition_type: string;
  power: number | null;
  speed: number | null;
  speed_pattern_id: number | null;
  efficiency_curve_id: number | null;
  energy_price: number | null;
  energy_price_pattern_id: number | null;
  curve_id: number | null;
  curve_points: string | null;
};

export type ValveRow = LinkRowShared & {
  diameter: number | null;
  minor_loss: number | null;
  valve_kind: string | null;
  setting: number | null;
  curve_id: number | null;
};

export type AssetRows = {
  junctions: JunctionRow[];
  reservoirs: ReservoirRow[];
  tanks: TankRow[];
  pipes: PipeRow[];
  pumps: PumpRow[];
  valves: ValveRow[];
};

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

export type PatternRow = {
  id: number;
  label: string;
  type: string | null;
  multipliers: string;
};

export type JunctionDemandRow = {
  junction_id: number;
  ordinal: number;
  base_demand: number;
  pattern_id: number | null;
};

export type CurveRow = {
  id: number;
  label: string;
  type: string | null;
  points: string;
};

export const findMaxId = (
  assetRows: AssetRows,
  cpData?: CustomerPointsData,
  patternRows?: PatternRow[],
  curveRows?: CurveRow[],
): number => {
  let max = 0;
  const scan = (arr: { id: number }[]) => {
    for (const r of arr) if (r.id > max) max = r.id;
  };
  scan(assetRows.junctions);
  scan(assetRows.reservoirs);
  scan(assetRows.tanks);
  scan(assetRows.pipes);
  scan(assetRows.pumps);
  scan(assetRows.valves);
  if (cpData) scan(cpData.customerPoints);
  if (patternRows) scan(patternRows);
  if (curveRows) scan(curveRows);
  return max;
};
