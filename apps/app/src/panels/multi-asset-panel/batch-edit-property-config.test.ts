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

const isOptional = (properties: EditableProperties, key: string): boolean => {
  const config = properties[key];
  return config?.fieldType === "quantity"
    ? (config.isOptional ?? false)
    : false;
};

const validatorFor = (
  properties: EditableProperties,
  key: string,
): ((value: number) => boolean) | undefined => {
  const config = properties[key];
  return config?.fieldType === "quantity" ? config.validate : undefined;
};

const commitsInvalid = (
  properties: EditableProperties,
  key: string,
): boolean => {
  const config = properties[key];
  return config?.fieldType === "quantity"
    ? (config.commitInvalidValues ?? false)
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
    // minorLoss is EPANET-optional: optional (not nullable) under the flag.
    expect(isNullable(properties, "minorLoss")).toBe(false);
    expect(isOptional(properties, "minorLoss")).toBe(true);
    expect(isNullable(BATCH_EDITABLE_PROPERTIES.pipe, "roughness")).toBe(false);
  });

  it("makes EPANET-optional attributes optional only when allowed", () => {
    expect(isOptional(BATCH_EDITABLE_PROPERTIES.pipe, "minorLoss")).toBe(false);

    const junction = withNullableProperties(
      BATCH_EDITABLE_PROPERTIES.junction,
      true,
      "junction",
    );
    expect(isOptional(junction, "emitterCoefficient")).toBe(true);

    const tank = withNullableProperties(
      BATCH_EDITABLE_PROPERTIES.tank,
      true,
      "tank",
    );
    expect(isOptional(tank, "minVolume")).toBe(true);
    expect(isOptional(tank, "mixingFraction")).toBe(true);
  });

  it("validates flag-optional fields with a sign/range check (always present)", () => {
    // The validator lives in the base config and is the single authority,
    // independent of the flag.
    expect(
      validatorFor(BATCH_EDITABLE_PROPERTIES.tank, "minVolume")?.(-1),
    ).toBe(false);

    const tank = withNullableProperties(
      BATCH_EDITABLE_PROPERTIES.tank,
      true,
      "tank",
    );
    // minVolume must be zero or greater.
    expect(validatorFor(tank, "minVolume")?.(-1)).toBe(false);
    expect(validatorFor(tank, "minVolume")?.(0)).toBe(true);
    // mixingFraction is limited to the unit range.
    expect(validatorFor(tank, "mixingFraction")?.(1.5)).toBe(false);
    expect(validatorFor(tank, "mixingFraction")?.(0.5)).toBe(true);
  });

  it("makes fields informational (commit-invalid) only under the flag", () => {
    // Off: the base validator is present and blocks (no commitInvalidValues).
    expect(
      validatorFor(BATCH_EDITABLE_PROPERTIES.pump, "energyPrice")?.(-1),
    ).toBe(false);
    expect(commitsInvalid(BATCH_EDITABLE_PROPERTIES.pump, "energyPrice")).toBe(
      false,
    );
    expect(commitsInvalid(BATCH_EDITABLE_PROPERTIES.tank, "minVolume")).toBe(
      false,
    );

    // On: the same validator now warns-and-commits instead of blocking.
    const pump = withNullableProperties(
      BATCH_EDITABLE_PROPERTIES.pump,
      true,
      "pump",
    );
    expect(validatorFor(pump, "energyPrice")?.(-1)).toBe(false);
    expect(commitsInvalid(pump, "energyPrice")).toBe(true);

    const tank = withNullableProperties(
      BATCH_EDITABLE_PROPERTIES.tank,
      true,
      "tank",
    );
    expect(commitsInvalid(tank, "minVolume")).toBe(true);
    expect(commitsInvalid(tank, "roughness")).toBe(false); // not a tank field

    const junction = withNullableProperties(
      BATCH_EDITABLE_PROPERTIES.junction,
      true,
      "junction",
    );
    expect(validatorFor(junction, "chemicalSourceStrength")?.(-1)).toBe(false);
    expect(commitsInvalid(junction, "chemicalSourceStrength")).toBe(true);
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
