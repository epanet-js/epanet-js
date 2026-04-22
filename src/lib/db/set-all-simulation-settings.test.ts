import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { serializeSimulationSettings } from "./set-all-simulation-settings";

describe("serializeSimulationSettings", () => {
  it("produces a JSON string that round-trips through JSON.parse", () => {
    const data = serializeSimulationSettings(defaultSimulationSettings);
    expect(JSON.parse(data)).toEqual(defaultSimulationSettings);
  });

  it("throws when a numeric field is NaN", () => {
    expect(() =>
      serializeSimulationSettings({
        ...defaultSimulationSettings,
        globalDemandMultiplier: NaN,
      }),
    ).toThrow(/Simulation settings: data does not match schema/);
  });

  it("throws when a numeric field is Infinity", () => {
    expect(() =>
      serializeSimulationSettings({
        ...defaultSimulationSettings,
        energyGlobalPrice: Infinity,
      }),
    ).toThrow(/Simulation settings: data does not match schema/);
  });
});
