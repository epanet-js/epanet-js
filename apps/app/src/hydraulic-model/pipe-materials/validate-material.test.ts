import { describe, it, expect } from "vitest";
import { validateEntry } from "./validate-material";

describe("validateEntry", () => {
  it("returns no errors for a valid entry", () => {
    expect(validateEntry({ age: 0, roughness: 140 })).toEqual([]);
  });

  it("flags both fields when both are null", () => {
    const errors = validateEntry({ age: null, roughness: null });
    expect(errors).toEqual([
      {
        field: "age",
        message: "pipeLibrary.validation.emptyEntries",
      },
      {
        field: "roughness",
        message: "pipeLibrary.validation.emptyEntries",
      },
    ]);
  });

  it("flags roughness when it is zero", () => {
    expect(validateEntry({ age: 0, roughness: 0 })).toEqual([
      {
        field: "roughness",
        message: "pipeLibrary.validation.roughnessPositive",
        value: "0",
      },
    ]);
  });

  it("flags roughness when it is negative", () => {
    expect(validateEntry({ age: 0, roughness: -5 })).toEqual([
      {
        field: "roughness",
        message: "pipeLibrary.validation.roughnessPositive",
        value: "-5",
      },
    ]);
  });

  it("flags age when it is negative", () => {
    expect(validateEntry({ age: -1, roughness: 140 })).toEqual([
      {
        field: "age",
        message: "pipeLibrary.validation.agePositive",
        value: "-1",
      },
    ]);
  });

  it("flags roughness when age is present but roughness is null", () => {
    expect(validateEntry({ age: 10, roughness: null })).toEqual([
      {
        field: "roughness",
        message: "pipeLibrary.validation.roughnessRequired",
      },
    ]);
  });

  it("flags age when roughness is present but age is null", () => {
    expect(validateEntry({ age: null, roughness: 140 })).toEqual([
      {
        field: "age",
        message: "pipeLibrary.validation.ageRequired",
      },
    ]);
  });

  it("returns multiple errors for an entry with both fields invalid", () => {
    expect(validateEntry({ age: -1, roughness: -5 })).toEqual([
      {
        field: "roughness",
        message: "pipeLibrary.validation.roughnessPositive",
        value: "-5",
      },
      {
        field: "age",
        message: "pipeLibrary.validation.agePositive",
        value: "-1",
      },
    ]);
  });

  it("flags age when it is NaN", () => {
    expect(validateEntry({ age: NaN, roughness: 140 })).toEqual([
      {
        field: "age",
        message: "pipeLibrary.validation.mustBeNumber",
        value: "NaN",
      },
    ]);
  });

  it("flags roughness when it is NaN", () => {
    expect(validateEntry({ age: 0, roughness: NaN })).toEqual([
      {
        field: "roughness",
        message: "pipeLibrary.validation.mustBeNumber",
        value: "NaN",
      },
    ]);
  });

  it("flags both fields when both are NaN", () => {
    expect(validateEntry({ age: NaN, roughness: NaN })).toEqual([
      {
        field: "age",
        message: "pipeLibrary.validation.mustBeNumber",
        value: "NaN",
      },
      {
        field: "roughness",
        message: "pipeLibrary.validation.mustBeNumber",
        value: "NaN",
      },
    ]);
  });
});
