import type { ZoneFeature } from "./read-zone-features";

export const getLabelProperties = (features: ZoneFeature[]): string[] => {
  if (features.length === 0) return [];

  const allKeys = new Set<string>();
  for (const feature of features) {
    if (feature.properties) {
      for (const key of Object.keys(feature.properties)) {
        allKeys.add(key);
      }
    }
  }

  return [...allKeys]
    .filter((key) =>
      features.every((feature) => {
        const value = feature.properties?.[key];
        return !isEmptyValue(value);
      }),
    )
    .sort((a, b) => a.localeCompare(b));
};

const isEmptyValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.replace(/[\s\0]+/g, "") === "");
