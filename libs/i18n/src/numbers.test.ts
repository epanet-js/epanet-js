import { localizeDecimal, parseDecimal } from "./numbers";

describe("localize decimal", () => {
  it("shows decimals when available", () => {
    expect(localizeDecimal(12.34)).toEqual("12.34");
    expect(localizeDecimal(12.1234567)).toEqual("12.123457");
    expect(localizeDecimal(10)).toEqual("10");
    expect(localizeDecimal(-10)).toEqual("-10");
    expect(localizeDecimal(1000)).toEqual("1,000");
    expect(localizeDecimal(1000.1234)).toEqual("1,000.1234");
  });

  it("rounds to a decimal when specified", () => {
    expect(localizeDecimal(12.34)).toEqual("12.34");
    expect(localizeDecimal(12.1234567, { decimals: 2 })).toEqual("12.12");
    expect(localizeDecimal(12.127, { decimals: 2 })).toEqual("12.13");
    expect(localizeDecimal(1000.1284, { decimals: 2 })).toEqual("1,000.13");
    expect(localizeDecimal(42, { decimals: 2 })).toEqual("42");
  });

  it("applies a limit to 6 decimals max", () => {
    expect(localizeDecimal(0.123456789012345)).toEqual("0.123457");
  });

  it("can localize in different locales", () => {
    expect(localizeDecimal(12.34, { locale: "es" })).toEqual("12,34");
    expect(localizeDecimal(12.1234567, { locale: "es", decimals: 2 })).toEqual(
      "12,12",
    );
    expect(localizeDecimal(10000.2, { locale: "es" })).toEqual("10.000,2");
  });

  it("can format to zero", () => {
    expect(localizeDecimal(0.000001)).toEqual("1.000e-6");
    expect(localizeDecimal(-1e-13)).toEqual("0");
    expect(localizeDecimal(1e-13)).toEqual("0");
    expect(localizeDecimal(1e-12)).toEqual("1.000e-12");
    expect(localizeDecimal(-0.000001)).toEqual("-1.000e-6");
  });

  it("switches to scientific notation when number too small", () => {
    expect(localizeDecimal(0.1234)).toEqual("0.1234");
    expect(localizeDecimal(0.001234)).toEqual("0.001234");
    expect(localizeDecimal(-0.001234)).toEqual("-0.001234");
    expect(localizeDecimal(-0.0001234)).toEqual("-1.234e-4");

    expect(localizeDecimal(0.000123, { locale: "es" })).toEqual("1,230e-4");
    expect(localizeDecimal(-0.000123, { locale: "es" })).toEqual("-1,230e-4");
  });

  it("switches to scientific notation when number too large", () => {
    expect(localizeDecimal(12345.67)).toEqual("12,345.67");
    expect(localizeDecimal(1234567800.91)).toEqual("1.235e+9");
    expect(localizeDecimal(1234567800.91, { locale: "es" })).toEqual(
      "1,235e+9",
    );
  });
});

describe("parse decimal", () => {
  it("reads a plain number", () => {
    expect(parseDecimal("1234")).toEqual(1234);
    expect(parseDecimal("1234.5")).toEqual(1234.5);
    expect(parseDecimal("-3.5")).toEqual(-3.5);
    expect(parseDecimal(".5")).toEqual(0.5);
    expect(parseDecimal("  12  ")).toEqual(12);
    expect(parseDecimal("1.5e-3")).toEqual(0.0015);
  });

  it("reads the separators off the number when only one of them can be the point", () => {
    for (const locale of ["en", "es"] as const) {
      expect(parseDecimal("1.234,56", { locale })).toEqual(1234.56);
      expect(parseDecimal("1,234.56", { locale })).toEqual(1234.56);
      expect(parseDecimal("1.234.567,89", { locale })).toEqual(1234567.89);
      expect(parseDecimal("1,234,567.89", { locale })).toEqual(1234567.89);
      expect(parseDecimal("0,002", { locale })).toEqual(0.002);
      expect(parseDecimal("1,5e-3", { locale })).toEqual(0.0015);
    }
  });

  it("takes a separator that repeats for grouping, since decimals do not", () => {
    expect(parseDecimal("1,234,567", { locale: "es" })).toEqual(1234567);
    expect(parseDecimal("1.234.567", { locale: "en" })).toEqual(1234567);
  });

  it("never reads a grouping that would start with a zero", () => {
    expect(parseDecimal("0.001", { locale: "es" })).toEqual(0.001);
    expect(parseDecimal("0,002", { locale: "en" })).toEqual(0.002);
  });

  it("leaves a lone separator to the locale", () => {
    expect(parseDecimal("1,234", { locale: "en" })).toEqual(1234);
    expect(parseDecimal("1,234", { locale: "es" })).toEqual(1.234);
    expect(parseDecimal("1.234", { locale: "en" })).toEqual(1.234);
    expect(parseDecimal("1.234", { locale: "es" })).toEqual(1234);
  });

  it("takes a stated decimal separator over the locale's", () => {
    expect(parseDecimal("1,234", { locale: "en", decimal: "," })).toEqual(
      1.234,
    );
    expect(parseDecimal("1.234", { locale: "es", decimal: "." })).toEqual(
      1.234,
    );
  });

  it("is nothing when no number can be read", () => {
    expect(parseDecimal("north")).toBeNull();
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("Infinity")).toBeNull();
  });

  it("is nothing when the separators make no number", () => {
    expect(parseDecimal("1,2,3")).toBeNull();
    expect(parseDecimal("1,234,567.89.12")).toBeNull();
  });
});
