import { parseLocaleNumber, reformatWithoutGroups } from "./locale-number";

describe("parse locale number", () => {
  it("es", () => {
    expect(parseLocaleNumber("1,2", "es")).toEqual(1.2);
    expect(parseLocaleNumber("-1,2", "es")).toEqual(-1.2);
    expect(parseLocaleNumber("1,234", "es")).toEqual(1.234);
    expect(parseLocaleNumber("-1,234", "es")).toEqual(-1.234);
    expect(parseLocaleNumber("10.001,2", "es")).toEqual(10001.2);
    expect(parseLocaleNumber("-10.001,2", "es")).toEqual(-10001.2);
    expect(parseLocaleNumber("10.001.230,2", "es")).toEqual(10001230.2);
    expect(parseLocaleNumber("-10.001.230,2", "es")).toEqual(-10001230.2);
    expect(parseLocaleNumber("1.234", "es")).toEqual(1234);
    expect(parseLocaleNumber("-1.234", "es")).toEqual(-1234);
    expect(parseLocaleNumber("1.2", "es")).toBeNaN();
    expect(parseLocaleNumber("10.2", "es")).toBeNaN();
    expect(parseLocaleNumber("100.2", "es")).toBeNaN();
    expect(parseLocaleNumber("1,000.2", "es")).toBeNaN();
    expect(parseLocaleNumber("100.00", "es")).toBeNaN();
    expect(parseLocaleNumber("10.00.000", "es")).toBeNaN();
    expect(parseLocaleNumber("10 00", "en")).toEqual(1000);
  });

  it("en", () => {
    expect(parseLocaleNumber("1.2", "en")).toEqual(1.2);
    expect(parseLocaleNumber("-1.2", "en")).toEqual(-1.2);
    expect(parseLocaleNumber("1.234", "en")).toEqual(1.234);
    expect(parseLocaleNumber("-1.234", "en")).toEqual(-1.234);
    expect(parseLocaleNumber("10,001.2", "en")).toEqual(10001.2);
    expect(parseLocaleNumber("-10,001.2", "en")).toEqual(-10001.2);
    expect(parseLocaleNumber("10,001,230.2", "en")).toEqual(10001230.2);
    expect(parseLocaleNumber("-10,001,230.2", "en")).toEqual(-10001230.2);
    expect(parseLocaleNumber("1,234", "en")).toEqual(1234);
    expect(parseLocaleNumber("-1,234", "en")).toEqual(-1234);
    expect(parseLocaleNumber("1,2", "en")).toBeNaN();
    expect(parseLocaleNumber("10,2", "en")).toBeNaN();
    expect(parseLocaleNumber("100,2", "en")).toBeNaN();
    expect(parseLocaleNumber("1.000,2", "en")).toBeNaN();
    expect(parseLocaleNumber("100,00", "en")).toBeNaN();
    expect(parseLocaleNumber("10,00,000", "en")).toBeNaN();
    expect(parseLocaleNumber("10 00", "en")).toEqual(1000);
  });
});

describe("remove groups formatting", () => {
  it("es", () => {
    expect(reformatWithoutGroups("10.000.000,40", "es")).toEqual("10000000,40");
  });

  it("en", () => {
    expect(reformatWithoutGroups("10,000,000.40", "en")).toEqual("10000000.40");
  });
});
