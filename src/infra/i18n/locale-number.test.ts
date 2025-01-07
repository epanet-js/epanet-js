import { parseLocaleNumber, reformatWithoutGroups } from "./locale-number";

describe("parse locale number", () => {
  it("parses decimal numbers in en", () => {
    expect(parseLocaleNumber("1.2", "en")).toEqual(1.2);
    expect(parseLocaleNumber("-1.2", "en")).toEqual(-1.2);
    expect(parseLocaleNumber("1.234", "en")).toEqual(1.234);
    expect(parseLocaleNumber("-1.234", "en")).toEqual(-1.234);
    expect(parseLocaleNumber("10,001.2", "en")).toEqual(10001.2);
    expect(parseLocaleNumber("-10,001.2", "en")).toEqual(-10001.2);
    expect(parseLocaleNumber("10,001,230.2", "en")).toEqual(10001230.2);
    expect(parseLocaleNumber("-10,001,230.2", "en")).toEqual(-10001230.2);
  });

  it("parses decimal numbers in es", () => {
    expect(parseLocaleNumber("1,2", "es")).toEqual(1.2);
    expect(parseLocaleNumber("-1,2", "es")).toEqual(-1.2);
    expect(parseLocaleNumber("1,234", "es")).toEqual(1.234);
    expect(parseLocaleNumber("-1,234", "es")).toEqual(-1.234);
    expect(parseLocaleNumber("10.001,2", "es")).toEqual(10001.2);
    expect(parseLocaleNumber("-10.001,2", "es")).toEqual(-10001.2);
    expect(parseLocaleNumber("10.001.230,2", "es")).toEqual(10001230.2);
    expect(parseLocaleNumber("-10.001.230,2", "es")).toEqual(-10001230.2);
  });

  it("supports scientific notation", () => {
    expect(parseLocaleNumber("1e5", "es")).toEqual(100000);
    expect(parseLocaleNumber("1,2e5", "es")).toEqual(120000);
    expect(parseLocaleNumber("1.2e5", "en")).toEqual(120000);
    expect(parseLocaleNumber("1E-5", "es")).toEqual(0.00001);
    expect(parseLocaleNumber("-1e-5", "es")).toEqual(-0.00001);
    expect(parseLocaleNumber("1e5", "en")).toEqual(100000);
    expect(parseLocaleNumber("1E-5", "en")).toEqual(0.00001);
    expect(parseLocaleNumber("-1e-5", "es")).toEqual(-0.00001);
    expect(parseLocaleNumber("1e-5e1", "es")).toBeNaN();
    expect(parseLocaleNumber("1e-5e1", "en")).toBeNaN();
  });

  it("complains when invalid symbols", () => {
    expect(parseLocaleNumber("-2")).toEqual(-2);
    expect(parseLocaleNumber("+2")).toEqual(2);
    expect(parseLocaleNumber("2-3")).toBeNaN();
    expect(parseLocaleNumber("2+3")).toBeNaN();
  });

  it("complains when invalid groups", () => {
    expect(parseLocaleNumber("1.2", "es")).toBeNaN();
    expect(parseLocaleNumber("10.2", "es")).toBeNaN();
    expect(parseLocaleNumber("100.2", "es")).toBeNaN();
    expect(parseLocaleNumber("1,000.2", "es")).toBeNaN();
    expect(parseLocaleNumber("100.00", "es")).toBeNaN();

    expect(parseLocaleNumber("1,2", "en")).toBeNaN();
    expect(parseLocaleNumber("10,2", "en")).toBeNaN();
    expect(parseLocaleNumber("100,2", "en")).toBeNaN();
    expect(parseLocaleNumber("1.000,2", "en")).toBeNaN();
    expect(parseLocaleNumber("100,00", "en")).toBeNaN();
    expect(parseLocaleNumber("10,00,000", "en")).toBeNaN();
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
