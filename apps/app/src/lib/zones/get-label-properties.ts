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

  return [...allKeys].filter((key) => {
    const values = new Set<string>();

    for (const feature of features) {
      const value = feature.properties?.[key];
      if (value === null || value === undefined) return false;

      const stringValue = String(value);
      if (values.has(stringValue)) return false;
      values.add(stringValue);
    }

    return true;
  });
};
