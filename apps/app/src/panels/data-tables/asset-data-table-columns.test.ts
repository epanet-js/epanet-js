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

  it("leaves required numeric columns non-nullable", () => {
    expect(isNullableColumn("diameter", true)).toBe(false);
    expect(isNullableColumn("length", true)).toBe(false);
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

  it("keeps required columns non-emptiable", () => {
    expect(isEmptiableColumn("diameter", true)).toBe(false);
  });
});
