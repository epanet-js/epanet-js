import { describe, it, expect } from "vitest";
import {
  BATCH_EDITABLE_PROPERTIES,
  withNullableProperties,
  EditableProperties,
} from "./batch-edit-property-config";

const isNullable = (properties: EditableProperties, key: string): boolean => {
  const config = properties[key];
  // `isNullable` is non-nullable by default (absent in the config).
  return config?.fieldType === "quantity"
    ? (config.isNullable ?? false)
    : false;
};

describe("withNullableProperties", () => {
  it("returns the original config when null values are not allowed", () => {
    const properties = withNullableProperties(
      BATCH_EDITABLE_PROPERTIES.pipe,
      false,
      "pipe",
    );

    expect(properties).toBe(BATCH_EDITABLE_PROPERTIES.pipe);
    expect(isNullable(properties, "roughness")).toBe(false);
  });

  it("makes batch-1 attributes nullable when null values are allowed", () => {
    const properties = withNullableProperties(
      BATCH_EDITABLE_PROPERTIES.pipe,
      true,
      "pipe",
    );

    expect(isNullable(properties, "roughness")).toBe(true);
    // minorLoss is EPANET-optional, excluded from the nullable batch.
    expect(isNullable(properties, "minorLoss")).toBe(false);
    expect(isNullable(BATCH_EDITABLE_PROPERTIES.pipe, "roughness")).toBe(false);
  });

  it("keeps pipe diameter required (deferred) while allowing valve diameter", () => {
    const pipe = withNullableProperties(
      BATCH_EDITABLE_PROPERTIES.pipe,
      true,
      "pipe",
    );
    const valve = withNullableProperties(
      BATCH_EDITABLE_PROPERTIES.valve,
      true,
      "valve",
    );

    expect(isNullable(pipe, "diameter")).toBe(false);
    expect(isNullable(valve, "diameter")).toBe(true);
  });
});
