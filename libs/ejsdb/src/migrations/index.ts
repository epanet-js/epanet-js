import m0001 from "./0001_initial.sql?raw";
import m0002 from "./0002_pump_definition_type.sql?raw";
import m0003 from "./0003_pipe_material_year.sql?raw";
import m0004 from "./0004_zones_table.sql?raw";

export const migrations: string[] = [m0001, m0002, m0003, m0004];

export const APP_VERSION = migrations.length;
