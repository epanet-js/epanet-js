import { presets } from "@epanet-js/project-settings";
import { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { SimulationSettingsBuilder } from "src/__helpers__/simulation-settings-builder";
import { patchEpanetLoader } from "src/__helpers__/epanet-loader";
import { InMemoryStorage } from "src/infra/storage";
import { buildInp } from "../../build-inp";
import { runSimulation, resetSimulationWorkerForTest } from "../worker";
import { EPSResultsReader } from "../eps-results-reader";

describe("variable speed pumps", () => {
  beforeAll(() => patchEpanetLoader());

  afterEach(() => {
    resetSimulationWorkerForTest();
    InMemoryStorage.resetAll();
  });

  describe("pressure", () => {
    it("holds a remote node on target, speeding up with demand", async () => {
      const reader = await simulate(
        pressureNetwork({ targetId: IDS.J2, target: 30 }),
      );

      const pressures = await junctionPressures(reader, IDS.J2);
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(pressures, 30, PRESSURE_TOL);
      expectSameOrder(speeds, demandsAt(DEMAND_FACTORS));
    });

    it("holds the pump's own discharge node on target", async () => {
      const reader = await simulate(
        pressureNetwork({ targetId: IDS.J1, target: 40 }),
      );

      const pressures = await junctionPressures(reader, IDS.J1);
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(pressures, 40, PRESSURE_TOL);
      expectSameOrder(speeds, demandsAt(DEMAND_FACTORS));
    });

    it("follows a scheduled target", async () => {
      const reader = await simulate(
        pressureNetwork({
          targetId: IDS.J2,
          target: 30,
          factors: [1],
          schedule: [
            { time: 0, target: 30 },
            { time: 3 * HOUR, target: 40 },
          ],
        }),
      );

      const pressures = await junctionPressures(reader, IDS.J2);
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(pressures.slice(0, 3), 30, PRESSURE_TOL);
      expectAllNear(pressures.slice(3), 40, PRESSURE_TOL);
      expect(Math.min(...speeds.slice(3))).toBeGreaterThan(
        Math.max(...speeds.slice(0, 3)),
      );
    });

    it("stays at minimum speed when the target needs less", async () => {
      const minSpeed = 0.72;
      const reader = await simulate(
        pressureNetwork({
          targetId: IDS.J2,
          target: 30,
          factors: [0.2, 1.4],
          minSpeed,
        }),
      );

      const pressures = await junctionPressures(reader, IDS.J2);
      const speeds = await pumpSettings(reader, IDS.PU1);

      for (const step of stepsWithFactor([0.2, 1.4], 0.2)) {
        expect(speeds[step]).toBeCloseTo(minSpeed, 3);
        expect(pressures[step]).toBeGreaterThan(30 + PRESSURE_TOL);
      }
      for (const step of stepsWithFactor([0.2, 1.4], 1.4)) {
        expect(speeds[step]).toBeGreaterThan(minSpeed);
        expect(Math.abs(pressures[step] - 30)).toBeLessThan(PRESSURE_TOL);
      }
    });

    it("stays at maximum speed when the target needs more", async () => {
      const maxSpeed = 0.72;
      const reader = await simulate(
        pressureNetwork({
          targetId: IDS.J2,
          target: 30,
          factors: [0.2, 1.4],
          maxSpeed,
        }),
        { allowWarnings: true },
      );

      const pressures = await junctionPressures(reader, IDS.J2);
      const speeds = await pumpSettings(reader, IDS.PU1);

      for (const step of stepsWithFactor([0.2, 1.4], 1.4)) {
        expect(speeds[step]).toBeCloseTo(maxSpeed, 3);
        expect(pressures[step]).toBeLessThan(30 - PRESSURE_TOL);
      }
      for (const step of stepsWithFactor([0.2, 1.4], 0.2)) {
        expect(speeds[step]).toBeLessThan(maxSpeed);
        expect(Math.abs(pressures[step] - 30)).toBeLessThan(PRESSURE_TOL);
      }
    });
  });

  describe("level", () => {
    it("lands the tank on target and keeps it there, pumping with demand", async () => {
      const reader = await simulate(levelNetwork({ target: 3 }));

      const levels = await tankLevels(reader, IDS.T1);
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(levels.slice(1), 3, LEVEL_TOL);
      expectSameOrder(speeds.slice(1), demandsAt(DEMAND_FACTORS).slice(1));
    });

    it("follows a scheduled target", async () => {
      const reader = await simulate(
        levelNetwork({
          target: 3,
          schedule: [
            { time: 0, target: 2.5 },
            { time: 3 * HOUR, target: 3.5 },
          ],
        }),
      );

      const levels = await tankLevels(reader, IDS.T1);

      expectAllNear(levels.slice(1, 4), 2.5, LEVEL_TOL);
      expectAllNear(levels.slice(4), 3.5, LEVEL_TOL);
    });
  });

  describe("flow", () => {
    it("holds the flow of a remote link, speeding up with demand", async () => {
      const reader = await simulate(remoteFlowNetwork({ target: 10 }));

      const flows = await pipeFlows(reader, IDS.P1);
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(flows, 10, FLOW_TOL);
      expectSameOrder(speeds, demandsAt(DEMAND_FACTORS));
    });

    it("holds the pump's own flow, slowing down as demand relieves the pipe", async () => {
      const reader = await simulate(localFlowNetwork({ target: 15 }));

      const flows = await pumpFlows(reader, IDS.PU1);
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(flows, 15, FLOW_TOL);
      expectSameOrder(
        speeds,
        demandsAt(DEMAND_FACTORS).map((demand) => -demand),
      );
    });

    it("holds a tank inlet's flow as it reverses to fill and empty the tank", async () => {
      const fillSteps = [0, 1, 2, 6, 7, 8];
      const drainSteps = [3, 4, 5, 9, 10, 11];
      const reader = await simulate(
        tankInletFlowNetwork({
          schedule: [
            { time: 0, target: 5 },
            { time: 3 * HOUR, target: -5 },
            { time: 6 * HOUR, target: 5 },
            { time: 9 * HOUR, target: -5 },
          ],
        }),
        { duration: 12 * HOUR },
      );

      const flows = await pipeFlows(reader, IDS.P1);
      const levels = await tankLevels(reader, IDS.T1);
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(
        fillSteps.map((step) => flows[step]),
        5,
        FLOW_TOL,
      );
      expectAllNear(
        drainSteps.map((step) => flows[step]),
        -5,
        FLOW_TOL,
      );
      for (const step of fillSteps) {
        expect(levels[step + 1]).toBeGreaterThan(levels[step]);
      }
      for (const step of drainSteps) {
        expect(levels[step + 1]).toBeLessThan(levels[step]);
      }
      expect(
        Math.min(...fillSteps.map((step) => speeds[step])),
      ).toBeGreaterThan(Math.max(...drainSteps.map((step) => speeds[step])));
    });
  });

  describe("lagged pumps", () => {
    it("opens the lag only when the lead alone cannot hold the target", async () => {
      const reader = await simulate(laggedPumpsNetwork({ target: 40 }));

      const pressures = await junctionPressures(reader, IDS.J2);
      const leadSpeeds = await pumpSettings(reader, IDS.PU1);
      const lagSpeeds = await pumpSettings(reader, IDS.PU2);
      const lagFlows = await pumpFlows(reader, IDS.PU2);

      expectAllNear(pressures, 40, PRESSURE_TOL);

      for (const step of stepsWithFactor(LAG_FACTORS, LAG_LOW)) {
        expect(Math.abs(lagFlows[step])).toBeLessThan(0.01);
      }
      for (const step of stepsWithFactor(LAG_FACTORS, LAG_HIGH)) {
        expect(lagFlows[step]).toBeGreaterThan(1);
        expect(lagSpeeds[step]).toBeCloseTo(leadSpeeds[step], 4);
      }
    });
  });
});

const IDS = {
  R1: 1,
  R2: 2,
  J1: 3,
  J2: 4,
  T1: 5,
  PU1: 6,
  PU2: 7,
  P1: 8,
  P2: 9,
  DEMAND_PATTERN: 100,
} as const;

const APP_ID = "variable-speed-pumps-test";
const HOUR = 3600;
const DURATION = 6 * HOUR;
const BASE_DEMAND = 10;
const DEMAND_FACTORS = [0.6, 1.4, 1.0, 0.8, 1.2, 0.7];
const LAG_LOW = 0.4;
const LAG_HIGH = 1.4;
const LAG_FACTORS = [LAG_LOW, LAG_HIGH, LAG_LOW, LAG_HIGH, LAG_LOW, LAG_HIGH];

const PRESSURE_TOL = 0.1;
const FLOW_TOL = 0.1;
const LEVEL_TOL = 0.05;

const PUMP_CURVE = [{ x: 20, y: 50 }];

type Schedule = { time: number; target: number }[];

//   R1 --PU1-- J1 --------P1-------- J2 (demand + pattern)
const pressureNetwork = ({
  targetId,
  target,
  factors = DEMAND_FACTORS,
  minSpeed = 0.3,
  maxSpeed = 1,
  schedule = [],
}: {
  targetId: number;
  target: number;
  factors?: number[];
  minSpeed?: number;
  maxSpeed?: number;
  schedule?: Schedule;
}) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 0 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunction(IDS.J2, { elevation: 0 })
    .aJunctionDemand(IDS.J2, [
      { baseDemand: BASE_DEMAND, patternId: IDS.DEMAND_PATTERN },
    ])
    .aDemandPattern(IDS.DEMAND_PATTERN, "DEM", factors)
    .aPump(IDS.PU1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: PUMP_CURVE,
    })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.J2,
      length: 1000,
      diameter: 200,
      roughness: 100,
    })
    .aVariableSpeedPumpControl({
      linkId: IDS.PU1,
      quantity: "pressure",
      targetId,
      target,
      minSpeed,
      maxSpeed,
      laggedPumpIds: [],
      schedule,
    })
    .build();

//   R1 --PU1-- J1 ---P1--- T1 ---P2--- J2 (demand + pattern)
const levelNetwork = ({
  target,
  schedule = [],
}: {
  target: number;
  schedule?: Schedule;
}) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 0 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aTank(IDS.T1, {
      elevation: 20,
      initialLevel: 2,
      minLevel: 0,
      maxLevel: 5,
      diameter: 5,
    })
    .aJunction(IDS.J2, { elevation: 0 })
    .aJunctionDemand(IDS.J2, [
      { baseDemand: BASE_DEMAND, patternId: IDS.DEMAND_PATTERN },
    ])
    .aDemandPattern(IDS.DEMAND_PATTERN, "DEM", DEMAND_FACTORS)
    .aPump(IDS.PU1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: PUMP_CURVE,
      speed: 0.7,
    })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.T1,
      length: 500,
      diameter: 200,
      roughness: 100,
    })
    .aPipe(IDS.P2, {
      startNodeId: IDS.T1,
      endNodeId: IDS.J2,
      length: 500,
      diameter: 200,
      roughness: 100,
    })
    .aVariableSpeedPumpControl({
      linkId: IDS.PU1,
      quantity: "level",
      targetId: IDS.T1,
      target,
      minSpeed: 0.3,
      maxSpeed: 1,
      laggedPumpIds: [],
      schedule,
    })
    .build();

//                   +---P1--- R2
//   R1 --PU1-- J1 --+
//                   +---P2--- J2 (demand + pattern)
const remoteFlowNetwork = ({ target }: { target: number }) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 0 })
    .aReservoir(IDS.R2, { head: 30 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunction(IDS.J2, { elevation: 0 })
    .aJunctionDemand(IDS.J2, [
      { baseDemand: BASE_DEMAND, patternId: IDS.DEMAND_PATTERN },
    ])
    .aDemandPattern(IDS.DEMAND_PATTERN, "DEM", DEMAND_FACTORS)
    .aPump(IDS.PU1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: PUMP_CURVE,
    })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.R2,
      length: 500,
      diameter: 200,
      roughness: 100,
    })
    .aPipe(IDS.P2, {
      startNodeId: IDS.J1,
      endNodeId: IDS.J2,
      length: 500,
      diameter: 200,
      roughness: 100,
    })
    .aVariableSpeedPumpControl({
      linkId: IDS.PU1,
      quantity: "flow",
      targetId: IDS.P1,
      target,
      minSpeed: 0.3,
      maxSpeed: 1,
      laggedPumpIds: [],
      schedule: [],
    })
    .build();

//   R1 --PU1-- J1 (demand + pattern) ---P1--- R2
const localFlowNetwork = ({ target }: { target: number }) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 0 })
    .aReservoir(IDS.R2, { head: 30 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunctionDemand(IDS.J1, [
      { baseDemand: BASE_DEMAND, patternId: IDS.DEMAND_PATTERN },
    ])
    .aDemandPattern(IDS.DEMAND_PATTERN, "DEM", DEMAND_FACTORS)
    .aPump(IDS.PU1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: PUMP_CURVE,
    })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.R2,
      length: 500,
      diameter: 100,
      roughness: 100,
    })
    .aVariableSpeedPumpControl({
      linkId: IDS.PU1,
      quantity: "flow",
      targetId: IDS.PU1,
      target,
      minSpeed: 0.3,
      maxSpeed: 1,
      laggedPumpIds: [],
      schedule: [],
    })
    .build();

//   R1 --PU1-- J1 (demand) ---P1---> T1
const tankInletFlowNetwork = ({ schedule }: { schedule: Schedule }) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 15 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunctionDemand(IDS.J1, [{ baseDemand: 20 }])
    .aTank(IDS.T1, {
      elevation: 20,
      initialLevel: 2,
      minLevel: 0,
      maxLevel: 5,
      diameter: 10,
    })
    .aPump(IDS.PU1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: [{ x: 30, y: 30 }],
    })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.T1,
      length: 500,
      diameter: 200,
      roughness: 100,
    })
    .aVariableSpeedPumpControl({
      linkId: IDS.PU1,
      quantity: "flow",
      targetId: IDS.P1,
      target: 5,
      minSpeed: 0.3,
      maxSpeed: 1,
      laggedPumpIds: [],
      schedule,
    })
    .build();

//   R1 --PU1--+
//             J1 --------P1-------- J2 (demand + pattern)
//   R1 --PU2--+
const laggedPumpsNetwork = ({ target }: { target: number }) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 0 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunction(IDS.J2, { elevation: 0 })
    .aJunctionDemand(IDS.J2, [
      { baseDemand: BASE_DEMAND, patternId: IDS.DEMAND_PATTERN },
    ])
    .aDemandPattern(IDS.DEMAND_PATTERN, "DEM", LAG_FACTORS)
    .aPump(IDS.PU1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: [{ x: 10, y: 50 }],
    })
    .aPump(IDS.PU2, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: [{ x: 10, y: 50 }],
      initialStatus: "off",
    })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.J2,
      length: 1000,
      diameter: 200,
      roughness: 100,
    })
    .aVariableSpeedPumpControl({
      linkId: IDS.PU1,
      quantity: "pressure",
      targetId: IDS.J2,
      target,
      minSpeed: 0.3,
      maxSpeed: 1,
      laggedPumpIds: [IDS.PU2],
      schedule: [],
    })
    .build();

const simulate = async (
  hydraulicModel: HydraulicModel,
  {
    allowWarnings = false,
    duration = DURATION,
  }: { allowWarnings?: boolean; duration?: number } = {},
): Promise<EPSResultsReader> => {
  const simulationSettings = SimulationSettingsBuilder.with()
    .timing({ duration })
    .build();

  const inp = buildInp(hydraulicModel, {
    units: presets.LPS.units,
    simulationSettings,
  });

  const result = await runSimulation(inp, APP_ID, () => {});
  if (allowWarnings) {
    expect(["success", "warning"]).toContain(result.status);
  } else {
    expect(result.status).toBe("success");
  }

  const reader = new EPSResultsReader(new InMemoryStorage(APP_ID));
  await reader.initialize();
  return reader;
};

const junctionPressures = async (reader: EPSResultsReader, id: number) =>
  Array.from((await reader.getTimeSeries(id, "junction", "pressure"))!.values);

const tankLevels = async (reader: EPSResultsReader, id: number) =>
  Array.from((await reader.getTimeSeries(id, "tank", "level"))!.values);

const pipeFlows = async (reader: EPSResultsReader, id: number) =>
  Array.from((await reader.getTimeSeries(id, "pipe", "flow"))!.values);

const pumpFlows = async (reader: EPSResultsReader, id: number) =>
  Array.from((await reader.getTimeSeries(id, "pump", "flow"))!.values);

const pumpSettings = async (reader: EPSResultsReader, id: number) =>
  Array.from((await reader.getTimeSeries(id, "pump", "setting"))!.values);

const stepCount = DURATION / HOUR + 1;

const demandsAt = (factors: number[]) =>
  Array.from(
    { length: stepCount },
    (_, step) => BASE_DEMAND * factors[step % factors.length],
  );

const stepsWithFactor = (factors: number[], factor: number) =>
  Array.from({ length: stepCount }, (_, step) => step).filter(
    (step) => factors[step % factors.length] === factor,
  );

const expectAllNear = (values: number[], target: number, tol: number) => {
  for (const value of values) {
    expect(Math.abs(value - target)).toBeLessThan(tol);
  }
};

const expectSameOrder = (values: number[], reference: number[]) => {
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values.length; j++) {
      if (reference[i] > reference[j]) {
        expect(values[i]).toBeGreaterThan(values[j]);
      }
    }
  }
};
