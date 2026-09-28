import {
  presets,
  Presets,
  withPressureUnit,
} from "@epanet-js/project-settings";
import { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { SimulationSettingsBuilder } from "src/__helpers__/simulation-settings-builder";
import { patchEpanetLoader } from "src/__helpers__/epanet-loader";
import { InMemoryStorage } from "src/infra/storage";
import { buildInp } from "../../build-inp";
import { runSimulation, resetSimulationWorkerForTest } from "../worker";
import { EPSResultsReader } from "../eps-results-reader";

type PressureUnit = "mwc" | "kPa" | "bar" | "fwc" | "psi";

type Units = {
  name: string;
  preset: keyof Presets;
  pressureUnit: PressureUnit;
  flow: (litersPerSecond: number) => number;
  length: (meters: number) => number;
  diameter: (millimeters: number) => number;
  pressure: (metersOfWater: number) => number;
};

const LPS_PER_CFS = 28.317;
const METERS_PER_FOOT = 0.3048;
const PSI_PER_FOOT = 0.4333;
const MILLIMETERS_PER_INCH = 25.4;

const PER_METER_OF_WATER: Record<PressureUnit, number> = {
  mwc: 1,
  kPa: 9.80665,
  bar: 0.0980665,
  fwc: 1 / METERS_PER_FOOT,
  psi: PSI_PER_FOOT / METERS_PER_FOOT,
};

const metric = (
  preset: keyof Presets,
  perLps: number,
  pressureUnit: Exclude<PressureUnit, "psi">,
): Units => ({
  name: `${preset} and ${pressureUnit}`,
  preset,
  pressureUnit,
  flow: (value) => value * perLps,
  length: (value) => value,
  diameter: (value) => value,
  pressure: (value) => value * PER_METER_OF_WATER[pressureUnit],
});

const usCustomary = (preset: keyof Presets, perCfs: number): Units => ({
  name: `${preset} and psi`,
  preset,
  pressureUnit: "psi",
  flow: (value) => (value * perCfs) / LPS_PER_CFS,
  length: (value) => value / METERS_PER_FOOT,
  diameter: (value) => value / MILLIMETERS_PER_INCH,
  pressure: (value) => value * PER_METER_OF_WATER.psi,
});

const UNIT_SYSTEMS = [
  metric("LPS", 1, "mwc"),
  metric("LPM", 60, "kPa"),
  metric("MLD", 0.0864, "bar"),
  metric("CMH", 3.6, "fwc"),
  metric("CMD", 86.4, "mwc"),
  usCustomary("CFS", 1),
  usCustomary("GPM", 448.831),
  usCustomary("MGD", 0.64632),
  usCustomary("IMGD", 0.5382),
  usCustomary("AFD", 1.9837),
];

describe.each(UNIT_SYSTEMS)("variable speed pumps in $name", (units) => {
  beforeAll(() => patchEpanetLoader());

  afterEach(() => {
    resetSimulationWorkerForTest();
    InMemoryStorage.resetAll();
  });

  describe("pressure", () => {
    it("starts a lead pump that is initially off", async () => {
      const reader = await simulate(
        units,
        pressureNetwork(units, {
          targetId: IDS.J2,
          target: 30,
          initialStatus: "off",
        }),
      );

      const pressures = await junctionPressures(reader, IDS.J2);
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(
        pressures,
        units.pressure(30),
        units.pressure(PRESSURE_TOL),
      );
      expectSameOrder(speeds, demandsAt(DEMAND_FACTORS));
    });

    it("holds a remote node on target, speeding up with demand", async () => {
      const reader = await simulate(
        units,
        pressureNetwork(units, { targetId: IDS.J2, target: 30 }),
      );

      const pressures = await junctionPressures(reader, IDS.J2);
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(
        pressures,
        units.pressure(30),
        units.pressure(PRESSURE_TOL),
      );
      expectSameOrder(speeds, demandsAt(DEMAND_FACTORS));
    });

    it("holds the pump's own discharge node on target", async () => {
      const reader = await simulate(
        units,
        pressureNetwork(units, { targetId: IDS.J1, target: 40 }),
      );

      const pressures = await junctionPressures(reader, IDS.J1);
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(
        pressures,
        units.pressure(40),
        units.pressure(PRESSURE_TOL),
      );
      expectSameOrder(speeds, demandsAt(DEMAND_FACTORS));
    });

    it("follows a scheduled target", async () => {
      const reader = await simulate(
        units,
        pressureNetwork(units, {
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

      expectAllNear(
        pressures.slice(0, 3),
        units.pressure(30),
        units.pressure(PRESSURE_TOL),
      );
      expectAllNear(
        pressures.slice(3),
        units.pressure(40),
        units.pressure(PRESSURE_TOL),
      );
      expect(Math.min(...speeds.slice(3))).toBeGreaterThan(
        Math.max(...speeds.slice(0, 3)),
      );
    });

    it("stays at minimum speed when the target needs less", async () => {
      const minSpeed = 0.72;
      const reader = await simulate(
        units,
        pressureNetwork(units, {
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
        expect(pressures[step]).toBeGreaterThan(
          units.pressure(30 + PRESSURE_TOL),
        );
      }
      for (const step of stepsWithFactor([0.2, 1.4], 1.4)) {
        expect(speeds[step]).toBeGreaterThan(minSpeed);
        expect(Math.abs(pressures[step] - units.pressure(30))).toBeLessThan(
          units.pressure(PRESSURE_TOL),
        );
      }
    });

    it("stays at maximum speed when the target needs more", async () => {
      const maxSpeed = 0.72;
      const reader = await simulate(
        units,
        pressureNetwork(units, {
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
        expect(pressures[step]).toBeLessThan(units.pressure(30 - PRESSURE_TOL));
      }
      for (const step of stepsWithFactor([0.2, 1.4], 0.2)) {
        expect(speeds[step]).toBeLessThan(maxSpeed);
        expect(Math.abs(pressures[step] - units.pressure(30))).toBeLessThan(
          units.pressure(PRESSURE_TOL),
        );
      }
    });
  });

  describe("level", () => {
    it("lands the tank on target and keeps it there, pumping with demand", async () => {
      const reader = await simulate(units, levelNetwork(units, { target: 3 }));

      const levels = await tankLevels(
        reader,
        IDS.T1,
        units.length(TANK_ELEVATION),
      );
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(levels.slice(1), units.length(3), units.length(LEVEL_TOL));
      expectSameOrder(speeds.slice(1), demandsAt(DEMAND_FACTORS).slice(1));
    });

    it("follows a scheduled target", async () => {
      const reader = await simulate(
        units,
        levelNetwork(units, {
          target: 3,
          schedule: [
            { time: 0, target: 2.5 },
            { time: 3 * HOUR, target: 3.5 },
          ],
        }),
      );

      const levels = await tankLevels(
        reader,
        IDS.T1,
        units.length(TANK_ELEVATION),
      );

      expectAllNear(
        levels.slice(1, 4),
        units.length(2.5),
        units.length(LEVEL_TOL),
      );
      expectAllNear(
        levels.slice(4),
        units.length(3.5),
        units.length(LEVEL_TOL),
      );
    });
  });

  describe("flow", () => {
    it("holds the pump's own flow, slowing down as demand relieves the pipe", async () => {
      const reader = await simulate(
        units,
        localFlowNetwork(units, { target: 15 }),
      );

      const flows = await pumpFlows(reader, IDS.PU1);
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(flows, units.flow(15), units.flow(FLOW_TOL));
      expectSameOrder(
        speeds,
        demandsAt(DEMAND_FACTORS).map((demand) => -demand),
      );
    });

    it("holds the flow of a remote link, speeding up with demand", async () => {
      const reader = await simulate(
        units,
        remoteFlowNetwork(units, { target: 10 }),
      );

      const flows = await pipeFlows(reader, IDS.P1);
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(flows, units.flow(10), units.flow(FLOW_TOL));
      expectSameOrder(speeds, demandsAt(DEMAND_FACTORS));
    });

    it("holds a tank inlet's flow as it reverses to fill and empty the tank", async () => {
      const fillSteps = [0, 1, 2, 6, 7, 8];
      const drainSteps = [3, 4, 5, 9, 10, 11];
      const reader = await simulate(
        units,
        tankInletFlowNetwork(units, {
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
      const levels = await tankLevels(
        reader,
        IDS.T1,
        units.length(TANK_ELEVATION),
      );
      const speeds = await pumpSettings(reader, IDS.PU1);

      expectAllNear(
        fillSteps.map((step) => flows[step]),
        units.flow(5),
        units.flow(FLOW_TOL),
      );
      expectAllNear(
        drainSteps.map((step) => flows[step]),
        units.flow(-5),
        units.flow(FLOW_TOL),
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
      const reader = await simulate(
        units,
        laggedPumpsNetwork(units, { target: 40 }),
      );

      const pressures = await junctionPressures(reader, IDS.J2);
      const leadSpeeds = await pumpSettings(reader, IDS.PU1);
      const lagSpeeds = await pumpSettings(reader, IDS.PU2);
      const lagFlows = await pumpFlows(reader, IDS.PU2);

      expectAllNear(
        pressures,
        units.pressure(40),
        units.pressure(PRESSURE_TOL),
      );

      for (const step of stepsWithFactor(LAG_FACTORS, LAG_LOW)) {
        expect(Math.abs(lagFlows[step])).toBeLessThan(units.flow(0.01));
      }
      for (const step of stepsWithFactor(LAG_FACTORS, LAG_HIGH)) {
        expect(lagFlows[step]).toBeGreaterThan(units.flow(1));
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

const TANK_ELEVATION = 20;

const PRESSURE_TOL = 0.1;
const FLOW_TOL = 0.1;
const LEVEL_TOL = 0.05;

type Schedule = { time: number; target: number }[];

const pumpCurve = (units: Units, flow: number, head: number) => [
  { x: units.flow(flow), y: units.length(head) },
];

const inUnits = (schedule: Schedule, convert: (value: number) => number) =>
  schedule.map(({ time, target }) => ({ time, target: convert(target) }));

//   R1 --PU1-- J1 --------P1-------- J2 (demand + pattern)
const pressureNetwork = (
  units: Units,
  {
    targetId,
    target,
    factors = DEMAND_FACTORS,
    minSpeed = 0.3,
    maxSpeed = 1,
    schedule = [],
    initialStatus = "on",
  }: {
    targetId: number;
    target: number;
    factors?: number[];
    minSpeed?: number;
    maxSpeed?: number;
    schedule?: Schedule;
    initialStatus?: "on" | "off";
  },
) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 0 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunction(IDS.J2, { elevation: 0 })
    .aJunctionDemand(IDS.J2, [
      { baseDemand: units.flow(BASE_DEMAND), patternId: IDS.DEMAND_PATTERN },
    ])
    .aDemandPattern(IDS.DEMAND_PATTERN, "DEM", factors)
    .aPump(IDS.PU1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: pumpCurve(units, 20, 50),
      initialStatus,
    })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.J2,
      length: units.length(1000),
      diameter: units.diameter(200),
      roughness: 100,
    })
    .aVariableSpeedPumpControl({
      linkId: IDS.PU1,
      quantity: "pressure",
      targetId,
      target: units.pressure(target),
      minSpeed,
      maxSpeed,
      laggedPumpIds: [],
      schedule: inUnits(schedule, units.pressure),
    })
    .build();

//   R1 --PU1-- J1 ---P1--- T1 ---P2--- J2 (demand + pattern)
const levelNetwork = (
  units: Units,
  {
    target,
    schedule = [],
  }: {
    target: number;
    schedule?: Schedule;
  },
) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 0 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aTank(IDS.T1, {
      elevation: units.length(TANK_ELEVATION),
      initialLevel: units.length(2),
      minLevel: 0,
      maxLevel: units.length(5),
      diameter: units.length(5),
    })
    .aJunction(IDS.J2, { elevation: 0 })
    .aJunctionDemand(IDS.J2, [
      { baseDemand: units.flow(BASE_DEMAND), patternId: IDS.DEMAND_PATTERN },
    ])
    .aDemandPattern(IDS.DEMAND_PATTERN, "DEM", DEMAND_FACTORS)
    .aPump(IDS.PU1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: pumpCurve(units, 20, 50),
      speed: 0.7,
    })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.T1,
      length: units.length(500),
      diameter: units.diameter(200),
      roughness: 100,
    })
    .aPipe(IDS.P2, {
      startNodeId: IDS.T1,
      endNodeId: IDS.J2,
      length: units.length(500),
      diameter: units.diameter(200),
      roughness: 100,
    })
    .aVariableSpeedPumpControl({
      linkId: IDS.PU1,
      quantity: "level",
      targetId: IDS.T1,
      target: units.length(target),
      minSpeed: 0.3,
      maxSpeed: 1,
      laggedPumpIds: [],
      schedule: inUnits(schedule, units.length),
    })
    .build();

//                   +---P1--- R2
//   R1 --PU1-- J1 --+
//                   +---P2--- J2 (demand + pattern)
const remoteFlowNetwork = (units: Units, { target }: { target: number }) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 0 })
    .aReservoir(IDS.R2, { head: units.length(30) })
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunction(IDS.J2, { elevation: 0 })
    .aJunctionDemand(IDS.J2, [
      { baseDemand: units.flow(BASE_DEMAND), patternId: IDS.DEMAND_PATTERN },
    ])
    .aDemandPattern(IDS.DEMAND_PATTERN, "DEM", DEMAND_FACTORS)
    .aPump(IDS.PU1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: pumpCurve(units, 20, 50),
    })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.R2,
      length: units.length(500),
      diameter: units.diameter(200),
      roughness: 100,
    })
    .aPipe(IDS.P2, {
      startNodeId: IDS.J1,
      endNodeId: IDS.J2,
      length: units.length(500),
      diameter: units.diameter(200),
      roughness: 100,
    })
    .aVariableSpeedPumpControl({
      linkId: IDS.PU1,
      quantity: "flow",
      targetId: IDS.P1,
      target: units.flow(target),
      minSpeed: 0.3,
      maxSpeed: 1,
      laggedPumpIds: [],
      schedule: [],
    })
    .build();

//   R1 --PU1-- J1 (demand + pattern) ---P1--- R2
const localFlowNetwork = (units: Units, { target }: { target: number }) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 0 })
    .aReservoir(IDS.R2, { head: units.length(30) })
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunctionDemand(IDS.J1, [
      { baseDemand: units.flow(BASE_DEMAND), patternId: IDS.DEMAND_PATTERN },
    ])
    .aDemandPattern(IDS.DEMAND_PATTERN, "DEM", DEMAND_FACTORS)
    .aPump(IDS.PU1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: pumpCurve(units, 20, 50),
    })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.R2,
      length: units.length(500),
      diameter: units.diameter(100),
      roughness: 100,
    })
    .aVariableSpeedPumpControl({
      linkId: IDS.PU1,
      quantity: "flow",
      targetId: IDS.PU1,
      target: units.flow(target),
      minSpeed: 0.3,
      maxSpeed: 1,
      laggedPumpIds: [],
      schedule: [],
    })
    .build();

//   R1 --PU1-- J1 (demand) ---P1---> T1
const tankInletFlowNetwork = (
  units: Units,
  { schedule }: { schedule: Schedule },
) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: units.length(15) })
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunctionDemand(IDS.J1, [{ baseDemand: units.flow(20) }])
    .aTank(IDS.T1, {
      elevation: units.length(TANK_ELEVATION),
      initialLevel: units.length(2),
      minLevel: 0,
      maxLevel: units.length(5),
      diameter: units.length(10),
    })
    .aPump(IDS.PU1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: pumpCurve(units, 30, 30),
    })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.T1,
      length: units.length(500),
      diameter: units.diameter(200),
      roughness: 100,
    })
    .aVariableSpeedPumpControl({
      linkId: IDS.PU1,
      quantity: "flow",
      targetId: IDS.P1,
      target: units.flow(5),
      minSpeed: 0.3,
      maxSpeed: 1,
      laggedPumpIds: [],
      schedule: inUnits(schedule, units.flow),
    })
    .build();

//   R1 --PU1--+
//             J1 --------P1-------- J2 (demand + pattern)
//   R1 --PU2--+
const laggedPumpsNetwork = (units: Units, { target }: { target: number }) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 0 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunction(IDS.J2, { elevation: 0 })
    .aJunctionDemand(IDS.J2, [
      { baseDemand: units.flow(BASE_DEMAND), patternId: IDS.DEMAND_PATTERN },
    ])
    .aDemandPattern(IDS.DEMAND_PATTERN, "DEM", LAG_FACTORS)
    .aPump(IDS.PU1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: pumpCurve(units, 10, 50),
    })
    .aPump(IDS.PU2, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      curve: pumpCurve(units, 10, 50),
      initialStatus: "off",
    })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.J2,
      length: units.length(1000),
      diameter: units.diameter(200),
      roughness: 100,
    })
    .aVariableSpeedPumpControl({
      linkId: IDS.PU1,
      quantity: "pressure",
      targetId: IDS.J2,
      target: units.pressure(target),
      minSpeed: 0.3,
      maxSpeed: 1,
      laggedPumpIds: [IDS.PU2],
      schedule: [],
    })
    .build();

const simulate = async (
  units: Units,
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
    units: withPressureUnit(presets[units.preset], units.pressureUnit).units,
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

const tankLevels = async (
  reader: EPSResultsReader,
  id: number,
  elevation: number,
) =>
  Array.from(
    (await reader.getTimeSeries(id, "tank", "head"))!.values,
    (head) => head - elevation,
  );

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
    expect(Math.abs(value - target)).toBeLessThan(Math.abs(tol));
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
