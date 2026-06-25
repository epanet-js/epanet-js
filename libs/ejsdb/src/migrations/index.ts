import m0001 from "./0001_initial.sql?raw";
import m0002 from "./0002_pump_definition_type.sql?raw";
import m0003 from "./0003_pipe_material_year.sql?raw";
import m0004 from "./0004_zones_table.sql?raw";
import m0005 from "./0005_zones_bbox_adjacency.sql?raw";
import m0006 from "./0006_sanitize_labels";
import m0007 from "./0007_drop_zones_adjacency.sql?raw";
import m0008 from "./0008_rename_controls_to_raw_controls.sql?raw";
import m0009 from "./0009_create_controls_table.sql?raw";
import m0010 from "./0010_lowercase_enums.sql?raw";
import m0011 from "./0011_pipe_library.sql?raw";

export type MigrationDB = Parameters<typeof m0006>[0];

export type Migration = string | ((db: MigrationDB) => void);

export const migrations: Migration[] = [
  m0001,
  m0002,
  m0003,
  m0004,
  m0005,
  m0006,
  m0007,
  m0008,
  m0009,
  m0010,
  m0011,
];

export const APP_VERSION = migrations.length;
