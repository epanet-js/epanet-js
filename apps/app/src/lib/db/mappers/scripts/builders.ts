import { parseRows, scriptRowSchema } from "@epanet-js/ejsdb";
import type { UserScript } from "src/state/scripts";

export const buildScriptsData = (rawRows: unknown[]): UserScript[] =>
  parseRows(scriptRowSchema, rawRows, "Script").map((row) => ({
    id: row.id,
    name: row.name,
    source: row.source,
    apiVersion: row.api_version,
    updatedAt: row.updated_at,
  }));
