import {
  intCell,
  nullableInt,
  nullableReal,
  numberCell,
} from "@epanet-js/model-schema";
import { z } from "zod";
import {
  chemicalSourceTypes,
  pipeStatuses,
  pumpDefinitionTypes,
  pumpStatuses,
  tankMixingModels,
  valveKinds,
  valveStatuses,
} from "./enums";

export const linkCoordinatesSchema = z.array(z.array(numberCell));

const id = intCell;
const fkId = nullableInt;
const dbBool = z.union([z.literal(0), z.literal(1)]);
const finiteCoord = numberCell;
const chemicalSourceTypeSchema = z.enum(chemicalSourceTypes).nullable();

const nodeRowShared = {
  id,
  label: z.string().nullable(),
  is_active: dbBool,
  coord_x: finiteCoord,
  coord_y: finiteCoord,
  elevation: nullableReal,
  initial_quality: nullableReal,
  chemical_source_type: chemicalSourceTypeSchema,
  chemical_source_strength: nullableReal,
  chemical_source_pattern_id: fkId,
  custom_attributes: z.string().nullable().default(null),
} as const;

const linkRowShared = {
  id,
  label: z.string().nullable(),
  is_active: dbBool,
  start_node_id: id,
  end_node_id: id,
  coords: z.string(),
  length: nullableReal,
  custom_attributes: z.string().nullable().default(null),
} as const;

export const junctionRowSchema = z.object({
  ...nodeRowShared,
  emitter_coefficient: nullableReal,
});

export const reservoirRowSchema = z.object({
  ...nodeRowShared,
  head: nullableReal,
  head_pattern_id: fkId,
});

export const tankRowSchema = z.object({
  ...nodeRowShared,
  initial_level: nullableReal,
  min_level: nullableReal,
  max_level: nullableReal,
  min_volume: nullableReal,
  diameter: nullableReal,
  overflow: dbBool.nullable(),
  mixing_model: z.enum(tankMixingModels).nullable(),
  mixing_fraction: nullableReal,
  bulk_reaction_coeff: nullableReal,
  volume_curve_id: fkId,
});

export const pipeRowSchema = z.object({
  ...linkRowShared,
  initial_status: z.enum(pipeStatuses).nullable(),
  diameter: nullableReal,
  roughness: nullableReal,
  minor_loss: nullableReal,
  bulk_reaction_coeff: nullableReal,
  wall_reaction_coeff: nullableReal,
  material: z.string().nullable(),
  year: nullableReal,
});

export const pumpRowSchema = z.object({
  ...linkRowShared,
  initial_status: z.enum(pumpStatuses).nullable(),
  definition_type: z.enum(pumpDefinitionTypes),
  power: nullableReal,
  speed: nullableReal,
  speed_pattern_id: fkId,
  efficiency_curve_id: fkId,
  energy_price: nullableReal,
  energy_price_pattern_id: fkId,
  curve_id: fkId,
  curve_points: z.string().nullable(),
});

export const valveRowSchema = z.object({
  ...linkRowShared,
  initial_status: z.enum(valveStatuses).nullable(),
  diameter: nullableReal,
  minor_loss: nullableReal,
  valve_kind: z.enum(valveKinds).nullable(),
  setting: nullableReal,
  curve_id: fkId,
  target_node_id: fkId,
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
