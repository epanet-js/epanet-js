import { describe, it, expect } from "vitest";
import {
  BATCH_EDITABLE_PROPERTIES,
  EditableProperties,
  isOptionalProperty,
} from "./batch-edit-property-config";

const hasModelValidation = (
  properties: EditableProperties,
  key: string,
): boolean => {
  const config = properties[key];
  return config?.fieldType === "quantity"
    ? (config.hasModelValidation ?? false)
    : false;
};

const validatorFor = (
  properties: EditableProperties,
  key: string,
): ((value: number) => boolean) | undefined => {
  const config = properties[key];
  return config?.fieldType === "quantity" ? config.validate : undefined;
};

describe("BATCH_EDITABLE_PROPERTIES", () => {
  const { pipe, junction, tank, pump, valve } = BATCH_EDITABLE_PROPERTIES;

  it("keeps genuinely-required fields required with the flag on or off", () => {
    for (const key of [
      "roughness",
      "diameter",
      "length",
      "elevation",
      "initialLevel",
    ]) {
      expect(isOptionalProperty(key, false)).toBe(false);
      expect(isOptionalProperty(key, true)).toBe(false);
    }
  });

  it("makes EPANET-optional fields optional only when the flag is on", () => {
    for (const key of [
      "minorLoss",
      "emitterCoefficient",
      "minVolume",
      "mixingFraction",
      "speed",
      "initialQuality",
    ]) {
      expect(isOptionalProperty(key, false)).toBe(false);
      expect(isOptionalProperty(key, true)).toBe(true);
    }
  });

  it("keeps a few fields optional regardless of the flag", () => {
    for (const key of [
      "bulkReactionCoeff",
      "wallReactionCoeff",
      "energyPrice",
      "chemicalSourceStrength",
      "year",
    ]) {
      expect(isOptionalProperty(key, false)).toBe(true);
      expect(isOptionalProperty(key, true)).toBe(true);
    }
  });

  it("flags fields whose validity is deferred to model validation", () => {
    // Deferred: commit invalid/incomplete values informationally under the flag.
    expect(hasModelValidation(pipe, "roughness")).toBe(true);
    expect(hasModelValidation(pipe, "minorLoss")).toBe(true);
    expect(hasModelValidation(valve, "setting")).toBe(true);
    expect(hasModelValidation(valve, "diameter")).toBe(true);
    expect(hasModelValidation(tank, "initialLevel")).toBe(true);

    // Strict: enforced at input, block even under the flag.
    expect(hasModelValidation(pipe, "diameter")).toBe(false);
    expect(hasModelValidation(pipe, "length")).toBe(false);
    expect(hasModelValidation(junction, "elevation")).toBe(false);
    expect(hasModelValidation(tank, "minLevel")).toBe(false);
    expect(hasModelValidation(tank, "maxLevel")).toBe(false);
  });

  it("sources each quantity field's validator from the rules repository", () => {
    expect(validatorFor(tank, "minVolume")?.(-1)).toBe(false);
    expect(validatorFor(tank, "minVolume")?.(0)).toBe(true);
    expect(validatorFor(tank, "mixingFraction")?.(1.5)).toBe(false);
    expect(validatorFor(tank, "mixingFraction")?.(0.5)).toBe(true);
    expect(validatorFor(pump, "energyPrice")?.(-1)).toBe(false);
    expect(validatorFor(pipe, "diameter")?.(0)).toBe(false);
  });
});
