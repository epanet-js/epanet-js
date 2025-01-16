import { localizeDecimal } from "./numbers";

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
