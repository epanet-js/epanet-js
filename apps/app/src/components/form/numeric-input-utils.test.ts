import "src/__helpers__/locale";
import { describe, it, expect } from "vitest";
import { validationStateFor, isNumber } from "./numeric-input-utils";

const nonNegative = (value: number) => value >= 0;

describe("validationStateFor", () => {
  it("flags an empty required field (warns and blocks by default)", () => {
    expect(
      validationStateFor("", { isRequired: true, commitInvalidValues: false }),
    ).toEqual({
      hasError: true,
      isBlocked: true,
    });
  });

  it("lets a required field commit empty when commitInvalidValues is set", () => {
    expect(
      validationStateFor("", { isRequired: true, commitInvalidValues: true }),
    ).toEqual({
      hasError: true,
      isBlocked: false,
    });
  });

  it("does not flag an empty optional field", () => {
    expect(
      validationStateFor("", { isRequired: false, commitInvalidValues: false }),
    ).toEqual({
      hasError: false,
      isBlocked: false,
    });
  });

  it("flags a value that fails validate; blocks unless commitInvalidValues", () => {
    const opts = { isRequired: true, validate: nonNegative };
    expect(
      validationStateFor("-3", { ...opts, commitInvalidValues: false }),
    ).toEqual({
      hasError: true,
      isBlocked: true,
    });
    expect(
      validationStateFor("-3", { ...opts, commitInvalidValues: true }),
    ).toEqual({
      hasError: true,
      isBlocked: false,
    });
  });

  it("accepts a value that passes validate", () => {
    expect(
      validationStateFor("5", {
        isRequired: true,
        commitInvalidValues: false,
        validate: nonNegative,
      }),
    ).toEqual({ hasError: false, isBlocked: false });
  });

  it("always blocks a non-numeric value, even with commitInvalidValues", () => {
    expect(
      validationStateFor("abc", {
        isRequired: false,
        commitInvalidValues: true,
      }),
    ).toEqual({ hasError: true, isBlocked: true });
  });

  it("defaults validate to isNumber (a present number passes)", () => {
    expect(isNumber(NaN)).toBe(false);
    expect(
      validationStateFor("42", {
        isRequired: true,
        commitInvalidValues: false,
      }),
    ).toEqual({
      hasError: false,
      isBlocked: false,
    });
  });
});
