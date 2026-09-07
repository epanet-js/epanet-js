import { linkCoordinatesSchema } from "../schema/assets";
import type {
  JunctionRow,
  ReservoirRow,
  TankRow,
  PipeRow,
  PumpRow,
  ValveRow,
} from "../schema/assets";
import { pointsSchema, type CurveRow } from "../schema/curves";
import { multipliersSchema, type PatternRow } from "../schema/patterns";
import type { CustomerPointRow } from "../schema/customer-points";
import {
  column,
  toDbBool,
  toNullable,
  type ColumnMap,
  type ColumnWriter,
} from "./column-map";

type AssetSharedRow = Pick<JunctionRow, "id" | "label" | "is_active">;

type NodeSharedRow = Pick<
  JunctionRow,
  | "id"
  | "label"
  | "is_active"
  | "coord_x"
  | "coord_y"
  | "elevation"
  | "initial_quality"
  | "chemical_source_type"
  | "chemical_source_strength"
  | "chemical_source_pattern_id"
>;

type LinkSharedRow = Pick<
  PipeRow,
  | "id"
  | "label"
  | "is_active"
  | "start_node_id"
  | "end_node_id"
  | "coords"
  | "length"
>;

type Connection = {
  pipeId: number;
  junctionId: number;
  snapPoint: number[];
};

const toDbLinkCoordinates = (value: unknown): string => {
  const result = linkCoordinatesSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Link coords must be an array of finite-number arrays — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};

const toPumpCurvePoints = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const result = pointsSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Pump: inline curve points must be an array of {x,y} with finite numbers — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};

const toDbPoints = (value: unknown): string => {
  const result = pointsSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Curve points must be an array of {x,y} with finite numbers — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};

const toDbMultipliers = (value: unknown): string => {
  const result = multipliersSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Pattern multipliers must be an array of finite numbers — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};

const nodeCoordinates: ColumnWriter<NodeSharedRow> = (value) => {
  const coordinates = value as number[] | undefined;
  if (!Array.isArray(coordinates)) {
    return { coord_x: undefined, coord_y: undefined };
  }
  return { coord_x: coordinates[0], coord_y: coordinates[1] };
};

const linkCoordinates: ColumnWriter<LinkSharedRow> = (value) => ({
  coords: toDbLinkCoordinates(value),
});

const linkConnections: ColumnWriter<LinkSharedRow> = (value) => {
  const connections = value as number[] | undefined;
  if (!Array.isArray(connections)) {
    return { start_node_id: undefined, end_node_id: undefined };
  }
  return { start_node_id: connections[0], end_node_id: connections[1] };
};

const customerPointCoordinates: ColumnWriter<CustomerPointRow> = (value) => {
  const coordinates = value as number[] | undefined;
  if (!Array.isArray(coordinates)) {
    return { coord_x: undefined, coord_y: undefined };
  }
  return { coord_x: coordinates[0], coord_y: coordinates[1] };
};

const customerPointConnection: ColumnWriter<CustomerPointRow> = (value) => {
  const connection = value as Connection | null | undefined;
  if (!connection) {
    return { pipe_id: null, junction_id: null, snap_x: null, snap_y: null };
  }
  return {
    pipe_id: connection.pipeId,
    junction_id: connection.junctionId,
    snap_x: connection.snapPoint[0],
    snap_y: connection.snapPoint[1],
  };
};

const sharedAssetMap: ColumnMap<AssetSharedRow> = {
  label: column<AssetSharedRow>("label"),
  isActive: column<AssetSharedRow>("is_active", toDbBool),
};

const sharedNodeMap: ColumnMap<NodeSharedRow> = {
  ...sharedAssetMap,
  coordinates: nodeCoordinates,
  elevation: column<NodeSharedRow>("elevation"),
  initialQuality: column<NodeSharedRow>("initial_quality", toNullable),
  chemicalSourceType: column<NodeSharedRow>("chemical_source_type", toNullable),
  chemicalSourceStrength: column<NodeSharedRow>(
    "chemical_source_strength",
    toNullable,
  ),
  chemicalSourcePatternId: column<NodeSharedRow>(
    "chemical_source_pattern_id",
    toNullable,
  ),
};

const sharedLinkMap: ColumnMap<LinkSharedRow> = {
  ...sharedAssetMap,
  coordinates: linkCoordinates,
  connections: linkConnections,
  length: column<LinkSharedRow>("length", toNullable),
};

export const junctionMap: ColumnMap<JunctionRow> = {
  ...sharedNodeMap,
  emitterCoefficient: column<JunctionRow>("emitter_coefficient", toNullable),
};

export const reservoirMap: ColumnMap<ReservoirRow> = {
  ...sharedNodeMap,
  head: column<ReservoirRow>("head", toNullable),
  headPatternId: column<ReservoirRow>("head_pattern_id", toNullable),
};

export const tankMap: ColumnMap<TankRow> = {
  ...sharedNodeMap,
  initialLevel: column<TankRow>("initial_level", toNullable),
  minLevel: column<TankRow>("min_level", toNullable),
  maxLevel: column<TankRow>("max_level", toNullable),
  minVolume: column<TankRow>("min_volume", toNullable),
  diameter: column<TankRow>("diameter", toNullable),
  overflow: column<TankRow>("overflow", toDbBool),
  mixingModel: column<TankRow>("mixing_model", toNullable),
  mixingFraction: column<TankRow>("mixing_fraction", toNullable),
  bulkReactionCoeff: column<TankRow>("bulk_reaction_coeff", toNullable),
  volumeCurveId: column<TankRow>("volume_curve_id", toNullable),
};

export const pipeMap: ColumnMap<PipeRow> = {
  ...sharedLinkMap,
  initialStatus: column<PipeRow>("initial_status", toNullable),
  diameter: column<PipeRow>("diameter", toNullable),
  roughness: column<PipeRow>("roughness", toNullable),
  minorLoss: column<PipeRow>("minor_loss", toNullable),
  bulkReactionCoeff: column<PipeRow>("bulk_reaction_coeff", toNullable),
  wallReactionCoeff: column<PipeRow>("wall_reaction_coeff", toNullable),
  material: column<PipeRow>("material", toNullable),
  year: column<PipeRow>("year", toNullable),
};

export const pumpMap: ColumnMap<PumpRow> = {
  ...sharedLinkMap,
  initialStatus: column<PumpRow>("initial_status", toNullable),
  definitionType: column<PumpRow>("definition_type"),
  power: column<PumpRow>("power", toNullable),
  speed: column<PumpRow>("speed", toNullable),
  speedPatternId: column<PumpRow>("speed_pattern_id", toNullable),
  efficiencyCurveId: column<PumpRow>("efficiency_curve_id", toNullable),
  energyPrice: column<PumpRow>("energy_price", toNullable),
  energyPricePatternId: column<PumpRow>("energy_price_pattern_id", toNullable),
  curveId: column<PumpRow>("curve_id", toNullable),
  curve: column<PumpRow>("curve_points", toPumpCurvePoints),
};

export const valveMap: ColumnMap<ValveRow> = {
  ...sharedLinkMap,
  initialStatus: column<ValveRow>("initial_status", toNullable),
  diameter: column<ValveRow>("diameter", toNullable),
  minorLoss: column<ValveRow>("minor_loss", toNullable),
  kind: column<ValveRow>("valve_kind", toNullable),
  setting: column<ValveRow>("setting", toNullable),
  curveId: column<ValveRow>("curve_id", toNullable),
};

export const customerPointMap: ColumnMap<CustomerPointRow> = {
  label: column<CustomerPointRow>("label"),
  coordinates: customerPointCoordinates,
  connection: customerPointConnection,
};

export const curveMap: ColumnMap<CurveRow> = {
  label: column<CurveRow>("label"),
  type: column<CurveRow>("type", toNullable),
  points: column<CurveRow>("points", toDbPoints),
};

export const patternMap: ColumnMap<PatternRow> = {
  label: column<PatternRow>("label"),
  type: column<PatternRow>("type", toNullable),
  multipliers: column<PatternRow>("multipliers", toDbMultipliers),
};
