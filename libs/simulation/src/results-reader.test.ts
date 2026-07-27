import { describe, expect, it } from "vitest";
import { isSimulationProperty, simulationProperties } from "./results-reader";

describe("isSimulationProperty", () => {
  it("accepts every declared simulation property", () => {
    for (const property of simulationProperties) {
      expect(isSimulationProperty(property)).toBe(true);
    }
  });

  it("rejects properties that are not simulation results", () => {
    expect(isSimulationProperty("diameter")).toBe(false);
    expect(isSimulationProperty("elevation")).toBe(false);
    expect(isSimulationProperty("")).toBe(false);
  });
});
