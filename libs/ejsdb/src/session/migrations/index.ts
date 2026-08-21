import m0001 from "./0001_initial.sql?raw";

export const sessionMigrations: string[] = [m0001];

export const SESSION_VERSION = sessionMigrations.length;
