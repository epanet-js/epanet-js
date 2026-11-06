import type { Feature } from "geojson";
import type {
  CustomAttributeData,
  CustomAttributeValues,
} from "@epanet-js/converters";

export const readCustomAttributes = (
  feature: Feature,
  names: string[],
): CustomAttributeValues | null => {
  const values: CustomAttributeValues = {};
  let stated = false;

  for (const name of names) {
    const value: unknown = feature.properties?.[name];
    if (value === null || value === undefined || value === "") continue;

    values[name] = typeof value === "number" ? value : String(value);
    stated = true;
  }

  return stated ? values : null;
};

export const declareCustomAttributes = (
  names: string[],
  records: { customAttributes?: CustomAttributeValues }[],
): CustomAttributeData[] =>
  names
    .filter((name) =>
      records.some((record) => record.customAttributes?.[name] !== undefined),
    )
    .map((name) => ({
      ref: name,
      name,
      type: records.every((record) => {
        const value = record.customAttributes?.[name];
        return value === undefined || typeof value === "number";
      })
        ? ("number" as const)
        : ("text" as const),
    }));
