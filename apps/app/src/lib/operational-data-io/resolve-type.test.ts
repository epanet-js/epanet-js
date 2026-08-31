import type { PatternType } from "src/hydraulic-model";
import { resolveType } from "./resolve-type";

const labels: Record<PatternType, string> = {
  demand: "Demand",
  reservoirHead: "Reservoir head",
  pumpSpeed: "Pump speed",
  qualitySourceStrength: "Quality source strength",
  energyPrice: "Energy price",
};

describe("resolveType", () => {
  it("matches the enum key", () => {
    expect(resolveType("pumpSpeed", labels)).toEqual("pumpSpeed");
  });

  it("matches the translated label", () => {
    expect(resolveType("Reservoir head", labels)).toEqual("reservoirHead");
  });

  it("ignores case and extra whitespace", () => {
    expect(resolveType("  pump   SPEED ", labels)).toEqual("pumpSpeed");
  });

  it("accepts an unambiguous partial match", () => {
    expect(resolveType("energy", labels)).toEqual("energyPrice");
  });

  it("falls back to uncategorized when the partial is ambiguous", () => {
    expect(resolveType("e", labels)).toBeUndefined();
  });

  it("falls back to uncategorized for an unknown type", () => {
    expect(resolveType("something else", labels)).toBeUndefined();
  });

  it("treats a blank cell as uncategorized", () => {
    expect(resolveType("", labels)).toBeUndefined();
    expect(resolveType(null, labels)).toBeUndefined();
    expect(resolveType("   ", labels)).toBeUndefined();
  });

  it.each([
    ["a phrase built around the label", "Pump speed pattern", "pumpSpeed"],
    ["a label with a leading word", "The Demand", "demand"],
    ["an abbreviation of the label", "speed", "pumpSpeed"],
  ])("matches %s", (_case, cell, expected) => {
    expect(resolveType(cell, labels)).toEqual(expected);
  });

  it.each([
    ["a number", 42],
    ["punctuation instead of a space", "pump-speed"],
    ["an underscored enum key", "pump_speed"],
    ["a phrase naming two types", "Pump speed and demand"],
  ])("leaves %s uncategorized", (_case, cell) => {
    expect(resolveType(cell, labels)).toBeUndefined();
  });
});
