// Valves and pumps are links and therefore carry a `length` property internally
// (stored as null), but length is not a meaningful attribute for them. Omit it
// from data exports entirely rather than emitting an empty column.
const EXCLUDED_EXPORT_FIELDS: Record<string, ReadonlySet<string>> = {
  valve: new Set(["length"]),
  pump: new Set(["length"]),
};

export const isExportableField = (assetType: string, key: string): boolean =>
  !EXCLUDED_EXPORT_FIELDS[assetType]?.has(key);

export const exportableProperties = (
  assetType: string,
  keys: string[],
): string[] => keys.filter((key) => isExportableField(assetType, key));
