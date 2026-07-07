import { isExportableField, exportableProperties } from "./excluded-fields";

describe("excluded-fields", () => {
  it("excludes length for valves and pumps", () => {
    expect(isExportableField("valve", "length")).toBe(false);
    expect(isExportableField("pump", "length")).toBe(false);
  });

  it("keeps length for pipes", () => {
    expect(isExportableField("pipe", "length")).toBe(true);
  });

  it("keeps other fields for valves and pumps", () => {
    expect(isExportableField("valve", "diameter")).toBe(true);
    expect(isExportableField("pump", "power")).toBe(true);
  });

  it("filters excluded keys out of a property list", () => {
    expect(
      exportableProperties("valve", ["diameter", "length", "setting"]),
    ).toEqual(["diameter", "setting"]);
    expect(exportableProperties("pipe", ["diameter", "length"])).toEqual([
      "diameter",
      "length",
    ]);
  });
});
