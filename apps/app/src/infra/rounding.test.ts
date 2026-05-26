import { roundToSignificantDigits } from "./rounding";

describe("roundToSignificantDigits", () => {
  it("handles zero correctly", () => {
    expect(roundToSignificantDigits(0)).toBe(0);
  });

  it("rounds positive numbers > 1", () => {
    expect(roundToSignificantDigits(1234.567, 3)).toBe(1230);
    expect(roundToSignificantDigits(1.234567, 4)).toBe(1.235);
  });

  it("rounds positive numbers < 1", () => {
    expect(roundToSignificantDigits(0.001234, 2)).toBe(0.0012);
    expect(roundToSignificantDigits(0.00014, 2)).toBe(0.00014);
    expect(roundToSignificantDigits(0.000149, 2)).toBe(0.00015);
  });

  it("rounds negative numbers correctly", () => {
    expect(roundToSignificantDigits(-1234.567, 3)).toBe(-1230);
    expect(roundToSignificantDigits(-0.001234, 2)).toBe(-0.0012);
    expect(roundToSignificantDigits(-0.000149, 2)).toBe(-0.00015);
  });

  it("returns NaN for invalid digits or infinite numbers", () => {
    expect(roundToSignificantDigits(Infinity, 3)).toBeNaN();
    expect(roundToSignificantDigits(NaN, 3)).toBeNaN();
    expect(roundToSignificantDigits(1.234, 0)).toBeNaN();
    expect(roundToSignificantDigits(1.234, -2)).toBeNaN();
  });

  it("defaults to 3 digits when not provided", () => {
    expect(roundToSignificantDigits(0.000149)).toBe(0.000149);
    expect(roundToSignificantDigits(12345)).toBe(12300);
  });
});
