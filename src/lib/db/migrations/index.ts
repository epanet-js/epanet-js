import m0001 from "./0001_initial.sql?raw";
import m0002 from "./0002_pump_definition_type.sql?raw";

export const migrations: string[] = [m0001, m0002];

export const APP_VERSION = migrations.length;
