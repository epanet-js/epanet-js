import { describe, it, expect } from "vitest";
import {
  isNullableColumn,
  isOptionalColumn,
  isEmptiableColumn,
} from "./asset-data-table-columns";

describe("isOptionalColumn", () => {
  it("treats `?: T` properties as optional (cleared -> undefined)", () => {
    expect(isOptionalColumn("bulkReactionCoeff")).toBe(true);
    expect(isOptionalColumn("wallReactionCoeff")).toBe(true);
    expect(isOptionalColumn("energyPrice")).toBe(true);
    expect(isOptionalColumn("chemicalSourceStrength")).toBe(true);
  });

  it("does not treat roughness or required columns as optional", () => {
    expect(isOptionalColumn("roughness")).toBe(false);
    expect(isOptionalColumn("diameter")).toBe(false);
  });

  it("treats EPANET-optional columns as optional only when null values are allowed", () => {
    for (const key of [
      "minorLoss",
      "emitterCoefficient",
      "minVolume",
      "mixingFraction",
      "speed",
      "initialQuality",
    ]) {
      expect(isOptionalColumn(key)).toBe(false);
      expect(isOptionalColumn(key, true)).toBe(true);
    }
  });
});

describe("isNullableColumn", () => {
  it("treats roughness as nullable only when null values are allowed", () => {
    expect(isNullableColumn("roughness", false)).toBe(false);
    expect(isNullableColumn("roughness", true)).toBe(true);
  });

  it("does not treat optional columns as nullable (they map to undefined)", () => {
    expect(isNullableColumn("bulkReactionCoeff", false)).toBe(false);
    expect(isNullableColumn("bulkReactionCoeff", true)).toBe(false);
  });

  it("treats batch-1 nullable columns as nullable when allowed", () => {
    expect(isNullableColumn("diameter", false)).toBe(false);
    expect(isNullableColumn("diameter", true)).toBe(true);
    expect(isNullableColumn("setting", true)).toBe(true);
    expect(isNullableColumn("head", true)).toBe(true);
    expect(isNullableColumn("initialLevel", true)).toBe(true);
  });

  it("leaves deferred and optional-bound columns non-nullable", () => {
    expect(isNullableColumn("length", true)).toBe(false);
    expect(isNullableColumn("elevation", true)).toBe(false);
    expect(isNullableColumn("minLevel", true)).toBe(false);
    // EPANET-optional attributes are excluded from the nullable batch.
    expect(isNullableColumn("minorLoss", true)).toBe(false);
    expect(isNullableColumn("minVolume", true)).toBe(false);
    expect(isNullableColumn("emitterCoefficient", true)).toBe(false);
    expect(isNullableColumn("power", true)).toBe(false);
  });
});

describe("isEmptiableColumn", () => {
  it("lets optional columns render empty regardless of the flag", () => {
    expect(isEmptiableColumn("bulkReactionCoeff", false)).toBe(true);
    expect(isEmptiableColumn("bulkReactionCoeff", true)).toBe(true);
  });

  it("lets roughness render empty only when null values are allowed", () => {
    expect(isEmptiableColumn("roughness", false)).toBe(false);
    expect(isEmptiableColumn("roughness", true)).toBe(true);
  });

  it("lets batch-1 nullable columns render empty only when allowed", () => {
    expect(isEmptiableColumn("diameter", false)).toBe(false);
    expect(isEmptiableColumn("diameter", true)).toBe(true);
  });

  it("keeps deferred required columns non-emptiable", () => {
    expect(isEmptiableColumn("length", true)).toBe(false);
  });
});
