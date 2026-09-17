import { VALVE_TARGET_NODE_FIELD } from "./valve-target-node";

// Valves and pumps are links and therefore carry a `length` property internally
// (stored as null), but length is not a meaningful attribute for them. Omit it
// from data exports entirely rather than emitting an empty column.
const EXCLUDED_EXPORT_FIELDS: Record<string, ReadonlySet<string>> = {
  valve: new Set(["length"]),
  pump: new Set(["length"]),
};

export type ExportFieldOptions = {
  includeValveTargetNode?: boolean;
};

export const isExportableField = (
  assetType: string,
  key: string,
  { includeValveTargetNode = false }: ExportFieldOptions = {},
): boolean => {
  if (EXCLUDED_EXPORT_FIELDS[assetType]?.has(key)) return false;
  if (assetType === "valve" && key === VALVE_TARGET_NODE_FIELD) {
    return includeValveTargetNode;
  }
  return true;
};

export const exportableProperties = (
  assetType: string,
  keys: string[],
  options: ExportFieldOptions = {},
): string[] => keys.filter((key) => isExportableField(assetType, key, options));
