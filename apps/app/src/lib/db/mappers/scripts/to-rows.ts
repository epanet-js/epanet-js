import { parseRows, scriptRowSchema, type ScriptRow } from "@epanet-js/ejsdb";
import type { UserScript } from "src/state/scripts";

export const scriptToRow = (script: UserScript): ScriptRow => ({
  id: script.id,
  name: script.name,
  source: script.source,
  api_version: script.apiVersion,
  updated_at: script.updatedAt,
});

export const serializeScripts = (scripts: readonly UserScript[]): ScriptRow[] =>
  parseRows(scriptRowSchema, scripts.map(scriptToRow), "Script");

export const serializeScript = (script: UserScript): ScriptRow =>
  serializeScripts([script])[0];
