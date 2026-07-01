import { isValidInstallationYear } from "./property-validators";

describe("isValidInstallationYear", () => {
  it("accepts years within the 1000-9999 range", () => {
    expect(isValidInstallationYear(1000)).toBe(true);
    expect(isValidInstallationYear(1995)).toBe(true);
    expect(isValidInstallationYear(9999)).toBe(true);
  });

  it("rejects years outside the range", () => {
    expect(isValidInstallationYear(999)).toBe(false);
    expect(isValidInstallationYear(10000)).toBe(false);
    expect(isValidInstallationYear(0)).toBe(false);
    expect(isValidInstallationYear(-1)).toBe(false);
  });

  it("rejects non-integer years", () => {
    expect(isValidInstallationYear(1995.5)).toBe(false);
  });
});
