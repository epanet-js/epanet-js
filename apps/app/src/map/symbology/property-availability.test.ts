import type { EPSResultsReader } from "src/simulation";
import type { SimulationState } from "src/state/simulation";
import { aLinkSymbology, aNodeSymbology } from "src/__helpers__/state";
import { nullSymbologySpec } from "./symbology-types";
import {
  isColorPropertyAvailable,
  withUnavailableColorRulesDropped,
} from "./property-availability";

const idle: SimulationState = { status: "idle" };

const aRun = ({
  timestepCount = 1,
  qualityType = "none",
}: {
  timestepCount?: number;
  qualityType?: string;
} = {}): SimulationState => ({
  status: "success",
  report: "",
  modelVersion: "1",
  settingsVersion: "",
  epsResultsReader: {
    timestepCount,
    qualityType,
  } as unknown as EPSResultsReader,
});

describe("isColorPropertyAvailable", () => {
  it("needs results for simulation properties", () => {
    expect(isColorPropertyAvailable("pressure", idle)).toBe(false);
    expect(isColorPropertyAvailable("pressure", aRun())).toBe(true);
  });

  it("always allows model properties", () => {
    expect(isColorPropertyAvailable("elevation", idle)).toBe(true);
    expect(isColorPropertyAvailable("diameter", idle)).toBe(true);
  });

  it("needs an extended period run for min and max pressure", () => {
    expect(isColorPropertyAvailable("maxPressure", aRun())).toBe(false);
    expect(
      isColorPropertyAvailable("maxPressure", aRun({ timestepCount: 3 })),
    ).toBe(true);
  });

  it("needs the matching quality run for quality properties", () => {
    expect(isColorPropertyAvailable("waterAge", aRun())).toBe(false);
    expect(
      isColorPropertyAvailable("waterAge", aRun({ qualityType: "age" })),
    ).toBe(true);
    expect(
      isColorPropertyAvailable("waterTrace", aRun({ qualityType: "age" })),
    ).toBe(false);
  });
});

describe("withUnavailableColorRulesDropped", () => {
  it("draws an unavailable property with the default color", () => {
    const symbology = {
      ...nullSymbologySpec,
      node: aNodeSymbology({ colorRule: { property: "pressure" } }),
      link: aLinkSymbology({ colorRule: { property: "diameter" } }),
    };

    const result = withUnavailableColorRulesDropped(symbology, idle);

    expect(result.node.colorRule).toBeNull();
    expect(result.node.defaults).toBe(symbology.node.defaults);
    expect(result.link).toBe(symbology.link);
  });

  it("keeps the same symbology when everything is available", () => {
    const symbology = {
      ...nullSymbologySpec,
      node: aNodeSymbology({ colorRule: { property: "pressure" } }),
    };

    expect(withUnavailableColorRulesDropped(symbology, aRun())).toBe(symbology);
  });
});
