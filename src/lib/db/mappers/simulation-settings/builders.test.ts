import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { buildSimulationSettingsData } from "./builders";

describe("buildSimulationSettingsData", () => {
  it("returns the defaults for null input (fresh project)", () => {
    expect(buildSimulationSettingsData(null)).toEqual(
      defaultSimulationSettings,
    );
  });

  it("round-trips a full settings blob", () => {
    const data = JSON.stringify(defaultSimulationSettings);
    const parsed = buildSimulationSettingsData(data);
    expect(parsed).toEqual(defaultSimulationSettings);
  });

  it("preserves non-default values", () => {
    const custom = {
      ...defaultSimulationSettings,
      timing: {
        ...defaultSimulationSettings.timing,
        duration: 24 * 3600,
      },
      demandModel: "PDA" as const,
      qualitySimulationType: "chemical" as const,
      energyGlobalPatternId: 42,
    };

    const parsed = buildSimulationSettingsData(JSON.stringify(custom));
    expect(parsed.timing.duration).toBe(24 * 3600);
    expect(parsed.demandModel).toBe("PDA");
    expect(parsed.qualitySimulationType).toBe("chemical");
    expect(parsed.energyGlobalPatternId).toBe(42);
  });

  it("throws when the blob is not valid JSON", () => {
    expect(() => buildSimulationSettingsData("not-json")).toThrow(
      /Simulation settings: data is not valid JSON/,
    );
  });

  it("throws when a required field is missing", () => {
    const { demandModel: _demandModel, ...partial } = defaultSimulationSettings;
    expect(() => buildSimulationSettingsData(JSON.stringify(partial))).toThrow(
      /Simulation settings: data does not match schema/,
    );
  });

  it("throws when an enum value is unknown", () => {
    const bad = {
      ...defaultSimulationSettings,
      demandModel: "BOGUS",
    };
    expect(() => buildSimulationSettingsData(JSON.stringify(bad))).toThrow(
      /Simulation settings: data does not match schema/,
    );
  });

  it("throws when a numeric field is non-finite", () => {
    const bad = {
      ...defaultSimulationSettings,
      globalDemandMultiplier: "oops",
    };
    expect(() => buildSimulationSettingsData(JSON.stringify(bad))).toThrow(
      /Simulation settings: data does not match schema/,
    );
  });
});
