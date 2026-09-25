import { presets } from "@epanet-js/project-settings";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { SimulationSettingsBuilder } from "src/__helpers__/simulation-settings-builder";
import { patchEpanetLoader } from "src/__helpers__/epanet-loader";
import { InMemoryStorage } from "src/infra/storage";
import { buildInp } from "../../build-inp";
import { runSimulation, resetSimulationWorkerForTest } from "../worker";
import { EPSResultsReader } from "../eps-results-reader";

describe("remote setpoint PRV", () => {
  beforeAll(() => patchEpanetLoader());

  afterEach(() => {
    resetSimulationWorkerForTest();
    InMemoryStorage.resetAll();
  });

  it("holds the remote node on target while its demand swings", async () => {
    const result = await runSimulation(buildNetworkInp(), APP_ID, () => {});
    expect(result.status).toBe("success");

    const { pressures, settings } = await getResults();

    for (const pressure of pressures) {
      expect(Math.abs(pressure - REMOTE_TARGET)).toBeLessThan(0.05);
    }

    expect(settings.every((setting) => setting > REMOTE_TARGET + 0.5)).toBe(
      true,
    );
  });
});

const getResults = async (): Promise<{
  pressures: number[];
  settings: number[];
}> => {
  const reader = new EPSResultsReader(new InMemoryStorage(APP_ID));
  await reader.initialize();

  const pressureSeries = await reader.getTimeSeries(
    IDS.J2,
    "junction",
    "pressure",
  );
  const settingSeries = await reader.getTimeSeries(IDS.V1, "valve", "setting");

  const pressures = Array.from(pressureSeries!.values);
  const settings = Array.from(settingSeries!.values);

  return { pressures, settings };
};

const IDS = {
  R1: 1, // source reservoir
  N1: 2, // valve upstream
  J1: 3, // valve outlet
  J2: 4, // remote node
  P1: 5, // reservoir -> valve upstream
  V1: 6, // the remote-setpoint PRV
  P2: 7, // valve outlet -> remote node
  DEMAND_PATTERN: 100,
} as const;

const APP_ID = "remote-setpoint-prv-test";
const REMOTE_TARGET = 30;
const BASE_DEMAND = 10;
const DEMAND_MULTIPLIER = 3;
const PATTERN_FACTORS = [1.0, 1.4, 0.6, 1.7, 0.5, 1.2];

//   R1 --P1-- N1 --V1(PRV)-- J1 --------P2-------- J2 (demand + pattern)
const buildNetworkInp = (): string => {
  const hydraulicModel = HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 100 })
    .aJunction(IDS.N1, { elevation: 0 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunction(IDS.J2, { elevation: 0 })
    .aJunctionDemand(IDS.J2, [
      { baseDemand: BASE_DEMAND, patternId: IDS.DEMAND_PATTERN },
    ])
    .aDemandPattern(IDS.DEMAND_PATTERN, "DEM", PATTERN_FACTORS)
    .aPipe(IDS.P1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.N1,
      length: 100,
      diameter: 400,
      roughness: 100,
    })
    .aValve(IDS.V1, {
      startNodeId: IDS.N1,
      endNodeId: IDS.J1,
      diameter: 400,
      kind: "prv",
      setting: REMOTE_TARGET,
      targetNodeId: IDS.J2,
    })
    .aPipe(IDS.P2, {
      startNodeId: IDS.J1,
      endNodeId: IDS.J2,
      length: 1500,
      diameter: 200,
      roughness: 100,
    })
    .build();

  const simulationSettings = SimulationSettingsBuilder.with()
    .globalDemandMultiplier(DEMAND_MULTIPLIER)
    .timing({ duration: 6 * 3600 }) // 6 one-hour steps; 1h timesteps by default
    .build();

  return buildInp(hydraulicModel, {
    units: presets.LPS.units,
    simulationSettings,
  });
};
