import { describe, it, expect } from "vitest";
import {
  BATCH_EDITABLE_PROPERTIES,
  pipeEditablePropertiesFor,
} from "./batch-edit-property-config";

const roughnessIsNullable = (
  properties: ReturnType<typeof pipeEditablePropertiesFor>,
): boolean => {
  const roughness = properties.roughness;
  // `isNullable` is non-nullable by default (absent in the config).
  return roughness.fieldType === "quantity"
    ? (roughness.isNullable ?? false)
    : false;
};

describe("pipeEditablePropertiesFor", () => {
  it("keeps roughness non-nullable when null values are not allowed", () => {
    const properties = pipeEditablePropertiesFor(false);

    expect(properties).toBe(BATCH_EDITABLE_PROPERTIES.pipe);
    expect(roughnessIsNullable(properties)).toBe(false);
  });

  it("makes roughness nullable when null values are allowed", () => {
    const properties = pipeEditablePropertiesFor(true);

    expect(roughnessIsNullable(properties)).toBe(true);
    expect(roughnessIsNullable(BATCH_EDITABLE_PROPERTIES.pipe)).toBe(false);
  });
});
