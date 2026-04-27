import {
  sqliteTable,
  integer,
  real,
  text,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";

export const project = sqliteTable("project", {
  id: integer("id").primaryKey(),
  settings: text("settings").notNull(),
});

export const junctions = sqliteTable("junctions", {
  id: integer("id").primaryKey().$type<AssetId>(),
  label: text("label"),
  is_active: integer("is_active").notNull().default(1),
  coord_x: real("coord_x").notNull(),
  coord_y: real("coord_y").notNull(),
  elevation: real("elevation"),
  initial_quality: real("initial_quality"),
  chemical_source_type: text("chemical_source_type"),
  chemical_source_strength: real("chemical_source_strength"),
  chemical_source_pattern_id: integer("chemical_source_pattern_id"),
  emitter_coefficient: real("emitter_coefficient"),
});

export const reservoirs = sqliteTable("reservoirs", {
  id: integer("id").primaryKey().$type<AssetId>(),
  label: text("label"),
  is_active: integer("is_active").notNull().default(1),
  coord_x: real("coord_x").notNull(),
  coord_y: real("coord_y").notNull(),
  elevation: real("elevation"),
  initial_quality: real("initial_quality"),
  chemical_source_type: text("chemical_source_type"),
  chemical_source_strength: real("chemical_source_strength"),
  chemical_source_pattern_id: integer("chemical_source_pattern_id"),
  head: real("head"),
  head_pattern_id: integer("head_pattern_id"),
});

export const tanks = sqliteTable("tanks", {
  id: integer("id").primaryKey().$type<AssetId>(),
  label: text("label"),
  is_active: integer("is_active").notNull().default(1),
  coord_x: real("coord_x").notNull(),
  coord_y: real("coord_y").notNull(),
  elevation: real("elevation"),
  initial_quality: real("initial_quality"),
  chemical_source_type: text("chemical_source_type"),
  chemical_source_strength: real("chemical_source_strength"),
  chemical_source_pattern_id: integer("chemical_source_pattern_id"),
  initial_level: real("initial_level"),
  min_level: real("min_level"),
  max_level: real("max_level"),
  min_volume: real("min_volume"),
  diameter: real("diameter"),
  overflow: integer("overflow"),
  mixing_model: text("mixing_model"),
  mixing_fraction: real("mixing_fraction"),
  bulk_reaction_coeff: real("bulk_reaction_coeff"),
  volume_curve_id: integer("volume_curve_id"),
});

export const pipes = sqliteTable("pipes", {
  id: integer("id").primaryKey().$type<AssetId>(),
  label: text("label"),
  is_active: integer("is_active").notNull().default(1),
  start_node_id: integer("start_node_id").notNull().$type<AssetId>(),
  end_node_id: integer("end_node_id").notNull().$type<AssetId>(),
  coords: text("coords").notNull(),
  length: real("length"),
  initial_status: text("initial_status"),
  diameter: real("diameter"),
  roughness: real("roughness"),
  minor_loss: real("minor_loss"),
  bulk_reaction_coeff: real("bulk_reaction_coeff"),
  wall_reaction_coeff: real("wall_reaction_coeff"),
});

export const pumps = sqliteTable("pumps", {
  id: integer("id").primaryKey().$type<AssetId>(),
  label: text("label"),
  is_active: integer("is_active").notNull().default(1),
  start_node_id: integer("start_node_id").notNull().$type<AssetId>(),
  end_node_id: integer("end_node_id").notNull().$type<AssetId>(),
  coords: text("coords").notNull(),
  length: real("length"),
  initial_status: text("initial_status"),
  definition_type: text("definition_type").notNull(),
  power: real("power"),
  speed: real("speed"),
  speed_pattern_id: integer("speed_pattern_id"),
  efficiency_curve_id: integer("efficiency_curve_id"),
  energy_price: real("energy_price"),
  energy_price_pattern_id: integer("energy_price_pattern_id"),
  curve_id: integer("curve_id"),
  curve_points: text("curve_points"),
});

export const valves = sqliteTable("valves", {
  id: integer("id").primaryKey().$type<AssetId>(),
  label: text("label"),
  is_active: integer("is_active").notNull().default(1),
  start_node_id: integer("start_node_id").notNull().$type<AssetId>(),
  end_node_id: integer("end_node_id").notNull().$type<AssetId>(),
  coords: text("coords").notNull(),
  length: real("length"),
  initial_status: text("initial_status"),
  diameter: real("diameter"),
  minor_loss: real("minor_loss"),
  valve_kind: text("valve_kind"),
  setting: real("setting"),
  curve_id: integer("curve_id"),
});

export const customer_points = sqliteTable("customer_points", {
  id: integer("id").primaryKey(),
  label: text("label").notNull(),
  coord_x: real("coord_x").notNull(),
  coord_y: real("coord_y").notNull(),
  pipe_id: integer("pipe_id"),
  junction_id: integer("junction_id"),
  snap_x: real("snap_x"),
  snap_y: real("snap_y"),
});

export const customer_point_demands = sqliteTable(
  "customer_point_demands",
  {
    customer_point_id: integer("customer_point_id")
      .notNull()
      .references(() => customer_points.id),
    ordinal: integer("ordinal").notNull(),
    base_demand: real("base_demand").notNull(),
    pattern_id: integer("pattern_id"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.customer_point_id, t.ordinal] }),
  }),
);

export const patterns = sqliteTable("patterns", {
  id: integer("id").primaryKey(),
  label: text("label").notNull(),
  type: text("type"),
  multipliers: text("multipliers").notNull(),
});

export const junction_demands = sqliteTable(
  "junction_demands",
  {
    junction_id: integer("junction_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    base_demand: real("base_demand").notNull(),
    pattern_id: integer("pattern_id"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.junction_id, t.ordinal] }),
  }),
);

export const curves = sqliteTable("curves", {
  id: integer("id").primaryKey(),
  label: text("label").notNull(),
  type: text("type"),
  points: text("points").notNull(),
});

export const controls = sqliteTable("controls", {
  id: integer("id").primaryKey(),
  data: text("data").notNull(),
});

export const simulation_settings = sqliteTable("simulation_settings", {
  id: integer("id").primaryKey(),
  data: text("data").notNull(),
});

export const schema = {
  project,
  junctions,
  reservoirs,
  tanks,
  pipes,
  pumps,
  valves,
  customer_points,
  customer_point_demands,
  patterns,
  junction_demands,
  curves,
  controls,
  simulation_settings,
};
