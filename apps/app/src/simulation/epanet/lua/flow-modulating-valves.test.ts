import {
  presets,
  Presets,
  withPressureUnit,
} from "@epanet-js/project-settings";
import { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
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

const LPS = metric("LPS", 1, "mwc");

const UNIT_SYSTEMS = [
  LPS,
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

describe("flow-modulating valves", () => {
  beforeAll(() => patchEpanetLoader());

  afterEach(() => {
    resetSimulationWorkerForTest();
    InMemoryStorage.resetAll();
  });

  describe.each(UNIT_SYSTEMS)("in $name", (units) => {
    it("holds the outlet at the curve's linear pressure for the valve's flow", async () => {
      const reader = await simulate(units, fmvNetwork(units));

      const flows = await valveFlows(reader);
      const pressures = await junctionPressures(reader, IDS.J1);

      expectOnCurve(units, flows, pressures, true);
    });
  });

  it("follows the demand along the linear curve", async () => {
    const reader = await simulate(LPS, fmvNetwork(LPS));

    const flows = await valveFlows(reader);
    const pressures = await junctionPressures(reader, IDS.J1);

    expectAllNear(flows, DEMAND_FLOWS, FLOW_TOL);
    expectAllNear(pressures, LINEAR_PRESSURES, PRESSURE_TOL);
  });

  it("holds the outlet at the pressure of the last point reached on a step grid", async () => {
    const reader = await simulate(LPS, fmvNetwork(LPS, { interpolate: false }));

    const flows = await valveFlows(reader);
    const pressures = await junctionPressures(reader, IDS.J1);

    expectOnCurve(LPS, flows, pressures, false);
    expectAllNear(pressures, STEP_PRESSURES, PRESSURE_TOL);
  });

  it("holds a remote control node at the curve's pressure", async () => {
    const reader = await simulate(
      LPS,
      fmvNetwork(LPS, { controlNodeId: IDS.J2 }),
    );

    const flows = await valveFlows(reader);
    const pressures = await junctionPressures(reader, IDS.J2);
    const outletPressures = await junctionPressures(reader, IDS.J1);

    expectOnCurve(LPS, flows, pressures, true);
    for (let step = 0; step < pressures.length; step++) {
      expect(outletPressures[step]).toBeGreaterThan(pressures[step]);
    }
  });

  it("reads the flow from a sensor link", async () => {
    const reader = await simulate(
      LPS,
      fmvNetwork(LPS, { sensorLinkId: IDS.P2 }),
    );

    const flows = await pipeFlows(reader, IDS.P2);
    const pressures = await junctionPressures(reader, IDS.J1);

    expectOnCurve(LPS, flows, pressures, true);
    expectAllNear(pressures, LINEAR_PRESSURES, PRESSURE_TOL);
  });
});

const IDS = {
  R1: 1,
  J0: 2,
  J1: 3,
  J2: 4,
  P1: 5,
  V1: 6,
  P2: 7,
  DEMAND_PATTERN: 100,
} as const;

const APP_ID = "flow-modulating-valves-test";
const HOUR = 3600;
const DURATION = 7 * HOUR;
const BASE_DEMAND = 8;
const DEMAND_FACTORS = [0.3, 0.5, 0.75, 1.0, 1.25, 1.5, 1.0, 0.6];
const CURVE = [
  { flow: 3, pressure: 20 },
  { flow: 5, pressure: 24 },
  { flow: 7, pressure: 30 },
  { flow: 9, pressure: 34 },
];

const DEMAND_FLOWS = [2.4, 4.0, 6.0, 8.0, 10.0, 12.0, 8.0, 4.8];
const LINEAR_PRESSURES = [20, 22, 27, 32, 34, 34, 32, 23.6];
const STEP_PRESSURES = [20, 20, 24, 30, 34, 34, 30, 20];

const PRESSURE_TOL = 0.05;
const FLOW_TOL = 0.001;

// The lookup the script runs: clamped at both ends, linear or held to the
// next point's flow, the flow unsigned
const curvePressure = (
  points: { flow: number; pressure: number }[],
  flow: number,
  interpolate: boolean,
) => {
  const q = Math.abs(flow);
  const last = points[points.length - 1];
  if (q <= points[0].flow) return points[0].pressure;
  if (q >= last.flow) return last.pressure;
  if (!interpolate) {
    let held = points[0].pressure;
    for (const point of points) if (q >= point.flow) held = point.pressure;
    return held;
  }
  for (let i = 0; i < points.length - 1; i++) {
    if (q <= points[i + 1].flow) {
      const span = points[i + 1].flow - points[i].flow;
      if (span <= 0) return points[i + 1].pressure;
      return (
        points[i].pressure +
        ((q - points[i].flow) / span) *
          (points[i + 1].pressure - points[i].pressure)
      );
    }
  }
  return last.pressure;
};

const curveIn = (units: Units) =>
  CURVE.map(({ flow, pressure }) => ({
    flow: units.flow(flow),
    pressure: units.pressure(pressure),
  }));

//   R1 ---P1--- J0 --V1-- J1 ---P2--- J2 (demand + pattern)
const fmvNetwork = (
  units: Units,
  {
    interpolate = true,
    sensorLinkId = IDS.V1,
    controlNodeId = IDS.J1,
  }: {
    interpolate?: boolean;
    sensorLinkId?: number;
    controlNodeId?: number;
  } = {},
) =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: units.length(60) })
    .aJunction(IDS.J0, { elevation: 0 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aJunction(IDS.J2, { elevation: units.length(2) })
    .aJunctionDemand(IDS.J2, [
      { baseDemand: units.flow(BASE_DEMAND), patternId: IDS.DEMAND_PATTERN },
    ])
    .aDemandPattern(IDS.DEMAND_PATTERN, "DEM", DEMAND_FACTORS)
    .aPipe(IDS.P1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J0,
      length: units.length(500),
      diameter: units.diameter(250),
      roughness: 110,
    })
    .aValve(IDS.V1, {
      startNodeId: IDS.J0,
      endNodeId: IDS.J1,
      kind: "prv",
      diameter: units.diameter(150),
      setting: units.pressure(20),
      minorLoss: 0,
    })
    .aPipe(IDS.P2, {
      startNodeId: IDS.J1,
      endNodeId: IDS.J2,
      length: units.length(600),
      diameter: units.diameter(150),
      roughness: 110,
    })
    .aFlowModulatingValveControl({
      linkId: IDS.V1,
      points: curveIn(units),
      interpolate,
      sensorLinkId,
      controlNodeId,
    })
    .build();

const simulate = async (
  units: Units,
  hydraulicModel: HydraulicModel,
): Promise<EPSResultsReader> => {
  const simulationSettings = SimulationSettingsBuilder.with()
    .timing({ duration: DURATION })
    .build();

  const inp = buildInp(hydraulicModel, {
    units: withPressureUnit(presets[units.preset], units.pressureUnit).units,
    simulationSettings,
  });

  const result = await runSimulation(inp, APP_ID, () => {});
  expect(result.status).toBe("success");

  const reader = new EPSResultsReader(new InMemoryStorage(APP_ID));
  await reader.initialize();
  return reader;
};

const junctionPressures = async (reader: EPSResultsReader, id: number) =>
  Array.from((await reader.getTimeSeries(id, "junction", "pressure"))!.values);

const pipeFlows = async (reader: EPSResultsReader, id: number) =>
  Array.from((await reader.getTimeSeries(id, "pipe", "flow"))!.values);

const valveFlows = async (reader: EPSResultsReader) =>
  Array.from((await reader.getTimeSeries(IDS.V1, "valve", "flow"))!.values);

const expectOnCurve = (
  units: Units,
  flows: number[],
  pressures: number[],
  interpolate: boolean,
) => {
  expect(pressures).toHaveLength(DURATION / HOUR + 1);
  for (let step = 0; step < pressures.length; step++) {
    const target = curvePressure(curveIn(units), flows[step], interpolate);
    expect(Math.abs(pressures[step] - target)).toBeLessThan(
      units.pressure(PRESSURE_TOL),
    );
  }
};

const expectAllNear = (values: number[], targets: number[], tol: number) => {
  expect(values).toHaveLength(targets.length);
  for (let i = 0; i < values.length; i++) {
    expect(Math.abs(values[i] - targets[i])).toBeLessThan(tol);
  }
};
