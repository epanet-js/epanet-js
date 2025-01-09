import { localizeDecimal } from "./numbers";

describe("localize decimal", () => {
  it("shows decimals when available", () => {
    expect(localizeDecimal(12.34)).toEqual("12.34");
    expect(localizeDecimal(12.1234567)).toEqual("12.1234567");
    expect(localizeDecimal(10)).toEqual("10");
    expect(localizeDecimal(1000)).toEqual("1,000");
    expect(localizeDecimal(1000.1234)).toEqual("1,000.1234");
  });

  it("limits the number of decimals when specified", () => {
    expect(localizeDecimal(12.34)).toEqual("12.34");
    expect(localizeDecimal(12.1234567, { decimals: 2 })).toEqual("12.12");
    expect(localizeDecimal(12.127, { decimals: 2 })).toEqual("12.13");
    expect(localizeDecimal(1000.1284, { decimals: 2 })).toEqual("1,000.13");
    expect(localizeDecimal(42, { decimals: 2 })).toEqual("42");
  });

  it("applies a limit to 9 decimals max", () => {
    expect(localizeDecimal(0.123456789012345)).toEqual("0.123456789");
  });

  it("can localize in different locales", () => {
    expect(localizeDecimal(12.34, { locale: "es" })).toEqual("12,34");
    expect(localizeDecimal(12.1234567, { locale: "es", decimals: 2 })).toEqual(
      "12,12",
    );
    expect(localizeDecimal(10000.2, { locale: "es" })).toEqual("10.000,2");
  });

  it("can format to zero", () => {
    expect(localizeDecimal(0.000001, { decimals: 1 })).toEqual("0");
    expect(localizeDecimal(-0.000001, { decimals: 1 })).toEqual("0");
    expect(localizeDecimal(0.000001)).toEqual("0.000001");
  });
});
