import { z } from "zod";
import { chemicalSourceTypes } from "src/hydraulic-model/asset-types/node";
import { pipeStatuses } from "src/hydraulic-model/asset-types/pipe";
import { pumpStatuses } from "src/hydraulic-model/asset-types/pump";
import {
  valveStatuses,
  valveKinds,
} from "src/hydraulic-model/asset-types/valve";
import { tankMixingModels } from "src/hydraulic-model/asset-types/tank";

export const linkCoordinatesSchema = z.array(z.array(z.number().finite()));

const id = z.number().int();
const fkId = z.number().int().nullable();
const dbBool = z.union([z.literal(0), z.literal(1)]);
const finiteCoord = z.number().finite();
const nullableNumber = z.number().nullable();
const chemicalSourceTypeSchema = z.enum(chemicalSourceTypes).nullable();

const nodeRowShared = {
  id,
  label: z.string().nullable(),
  is_active: dbBool,
  coord_x: finiteCoord,
  coord_y: finiteCoord,
  elevation: nullableNumber,
  initial_quality: nullableNumber,
  chemical_source_type: chemicalSourceTypeSchema,
  chemical_source_strength: nullableNumber,
  chemical_source_pattern_id: fkId,
} as const;

const linkRowShared = {
  id,
  label: z.string().nullable(),
  is_active: dbBool,
  start_node_id: id,
  end_node_id: id,
  coords: z.string(),
  length: nullableNumber,
} as const;

export const junctionRowSchema = z.object({
  ...nodeRowShared,
  type: z.literal("junction"),
  emitter_coefficient: nullableNumber,
});

export const reservoirRowSchema = z.object({
  ...nodeRowShared,
  type: z.literal("reservoir"),
  head: nullableNumber,
  head_pattern_id: fkId,
});

export const tankRowSchema = z.object({
  ...nodeRowShared,
  type: z.literal("tank"),
  initial_level: nullableNumber,
  min_level: nullableNumber,
  max_level: nullableNumber,
  min_volume: nullableNumber,
  diameter: nullableNumber,
  overflow: dbBool.nullable(),
  mixing_model: z.enum(tankMixingModels).nullable(),
  mixing_fraction: nullableNumber,
  bulk_reaction_coeff: nullableNumber,
  volume_curve_id: fkId,
});

export const pipeRowSchema = z.object({
  ...linkRowShared,
  type: z.literal("pipe"),
  initial_status: z.enum(pipeStatuses).nullable(),
  diameter: nullableNumber,
  roughness: nullableNumber,
  minor_loss: nullableNumber,
  bulk_reaction_coeff: nullableNumber,
  wall_reaction_coeff: nullableNumber,
});

export const pumpRowSchema = z.object({
  ...linkRowShared,
  type: z.literal("pump"),
  initial_status: z.enum(pumpStatuses).nullable(),
  definition_type: z.enum(["power", "curve", "curveId"]),
  power: nullableNumber,
  speed: nullableNumber,
  speed_pattern_id: fkId,
  efficiency_curve_id: fkId,
  energy_price: nullableNumber,
  energy_price_pattern_id: fkId,
  curve_id: fkId,
  curve_points: z.string().nullable(),
});

export const valveRowSchema = z.object({
  ...linkRowShared,
  type: z.literal("valve"),
  initial_status: z.enum(valveStatuses).nullable(),
  diameter: nullableNumber,
  minor_loss: nullableNumber,
  valve_kind: z.enum(valveKinds).nullable(),
  setting: nullableNumber,
  curve_id: fkId,
});

export type JunctionRow = z.infer<typeof junctionRowSchema>;
export type ReservoirRow = z.infer<typeof reservoirRowSchema>;
export type TankRow = z.infer<typeof tankRowSchema>;
export type PipeRow = z.infer<typeof pipeRowSchema>;
export type PumpRow = z.infer<typeof pumpRowSchema>;
export type ValveRow = z.infer<typeof valveRowSchema>;

export type AssetRows = {
  junctions: JunctionRow[];
  reservoirs: ReservoirRow[];
  tanks: TankRow[];
  pipes: PipeRow[];
  pumps: PumpRow[];
  valves: ValveRow[];
};
