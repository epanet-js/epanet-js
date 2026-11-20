import { presets } from "@epanet-js/project-settings";
import { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { SimulationSettingsBuilder } from "src/__helpers__/simulation-settings-builder";
import { patchEpanetLoader } from "src/__helpers__/epanet-loader";
import { InMemoryStorage } from "src/infra/storage";
import { buildInp } from "../../build-inp";
import { runSimulation, resetSimulationWorkerForTest } from "../worker";
import { EPSResultsReader } from "../eps-results-reader";

const APP_ID = "level-opening-valves";
const HOUR = 3600;
const DURATION = 12 * HOUR;
const STEP = 600;

const IDS = {
  R1: 1,
  J1: 2,
  T1: 3,
  J2: 4,
  P1: 5,
  V1: 6,
  P2: 7,
  C1: 8,
} as const;

const OPEN_LEVEL = 1.5;
const CLOSE_LEVEL = 3;
const DEMAND = 2;

describe("level-opening valves", () => {
  beforeAll(() => patchEpanetLoader());

  afterEach(() => {
    resetSimulationWorkerForTest();
    InMemoryStorage.resetAll();
  });

  it("throttles the inflow until it matches the outflow between the two levels", async () => {
    const reader = await simulate(network({ continuous: true }));

    const levels = await tankLevels(reader);
    const flows = await valveFlows(reader);
    const settled = flows.length - 1;

    expect(levels[settled]).toBeGreaterThan(OPEN_LEVEL);
    expect(levels[settled]).toBeLessThan(CLOSE_LEVEL);
    expect(flows[settled]).toBeCloseTo(DEMAND, 1);
    expect(Math.abs(levels[settled] - levels[settled - 1])).toBeLessThan(0.001);
  });

  it("stays closed above the close level", async () => {
    const reader = await simulate(
      network({ continuous: true, initialLevel: 4.5 }),
    );

    const levels = await tankLevels(reader);
    const flows = await valveFlows(reader);

    levels.forEach((level, step) => {
      if (level >= CLOSE_LEVEL) expect(flows[step]).toBe(0);
    });
    expect(flows[0]).toBe(0);
    expect(flows[flows.length - 1]).toBeGreaterThan(0);
  });

  it("does not change setting for an initially closed valve", async () => {
    const reader = await simulate(
      network({ continuous: true, initialStatus: "closed" }),
      "warning",
    );

    const flows = await valveFlows(reader);

    expect(flows.every((flow) => flow === 0)).toBe(true);
  });

  it("fully opens below the open level and closes above the close level when it is not continuous", async () => {
    const reader = await simulate(
      network({ continuous: false, initialLevel: 2, setting: 100 }),
    );

    const levels = await tankLevels(reader);
    const flows = await valveFlows(reader);

    expect(flows.some((flow) => flow === 0)).toBe(true);
    expect(flows.some((flow) => flow > DEMAND * 5)).toBe(true);
    expect(Math.max(...levels)).toBeLessThan(CLOSE_LEVEL + 0.5);
    expect(Math.min(...levels)).toBeGreaterThan(OPEN_LEVEL - 0.5);
  });
});

//   R1 ---P1--- J1 --V1-- T1 ---P2--- J2 (demand)
const network = ({
  continuous,
  initialLevel = 1,
  initialStatus = "active",
  setting = 50,
}: {
  continuous: boolean;
  initialLevel?: number;
  initialStatus?: "active" | "closed";
  setting?: number;
}) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 30 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aTank(IDS.T1, {
      elevation: 0,
      initialLevel,
      minLevel: 0,
      maxLevel: 5,
      diameter: 4,
    })
    .aJunction(IDS.J2, { elevation: 0 })
    .aJunctionDemand(IDS.J2, [{ baseDemand: DEMAND }])
    .aPipe(IDS.P1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      length: 100,
      diameter: 200,
      roughness: 100,
    })
    .aCurve({
      id: IDS.C1,
      type: "valve",
      points: [
        { x: 10, y: 1 },
        { x: 50, y: 20 },
        { x: 100, y: 100 },
      ],
    })
    .aValve(IDS.V1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.T1,
      kind: "pcv",
      diameter: 200,
      setting,
      minorLoss: 2,
      curveId: IDS.C1,
      initialStatus,
    })
    .aPipe(IDS.P2, {
      startNodeId: IDS.T1,
      endNodeId: IDS.J2,
      length: 100,
      diameter: 200,
      roughness: 100,
    })
    .aLevelOpeningControl({
      linkId: IDS.V1,
      tankId: IDS.T1,
      level: { open: OPEN_LEVEL, close: CLOSE_LEVEL },
      continuous,
    })
    .build();

const simulate = async (
  hydraulicModel: HydraulicModel,
  expectedStatus: "success" | "warning" = "success",
): Promise<EPSResultsReader> => {
  const simulationSettings = SimulationSettingsBuilder.with()
    .timing({ duration: DURATION, hydraulicTimestep: STEP })
    .build();

  const inp = buildInp(hydraulicModel, {
    units: presets.LPS.units,
    simulationSettings,
  });

  const result = await runSimulation(inp, APP_ID, () => {});
  expect(result.status).toBe(expectedStatus);

  const reader = new EPSResultsReader(new InMemoryStorage(APP_ID));
  await reader.initialize();
  return reader;
};

const tankLevels = async (reader: EPSResultsReader) =>
  Array.from((await reader.getTimeSeries(IDS.T1, "tank", "level"))!.values);

const valveFlows = async (reader: EPSResultsReader) =>
  Array.from((await reader.getTimeSeries(IDS.V1, "valve", "flow"))!.values);
