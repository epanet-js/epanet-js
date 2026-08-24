import type {
  ControlData,
  JunctionData,
  NetworkData,
  PipeData,
  PumpData,
  ReservoirData,
  TankData,
  ValveData,
} from "@epanet-js/converters";
import { WGS84, type Proj4Projection } from "@epanet-js/projections";
import type { LevelSettingControl } from "@epanet-js/hydraulic-model";
import {
  Junction,
  Pipe,
  Pump,
  Reservoir,
  Tank,
  Valve,
} from "src/hydraulic-model";
import { getByLabel } from "src/__helpers__/asset-queries";
import { buildModel } from "./build-model";

const webMercator: Proj4Projection = {
  type: "proj4",
  id: "EPSG:3857",
  name: "WGS 84 / Pseudo-Mercator",
  code: "EPSG:3857",
};

const aCatalogue = () => new Map([[webMercator.id, webMercator]]);

describe("build model from network data", () => {
  it("builds a junction with its label, coordinates and elevation", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: [aJunction({ ref: "1", label: "J1", elevation: 63 })],
      }),
      { projections: aCatalogue() },
    );

    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    expect(junction.coordinates).toEqual([10, 20]);
    expect(junction.elevation).toEqual(63);
  });

  it("leaves the elevation null when the source did not state one", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({ junctions: [aJunction({ ref: "1", label: "J1" })] }),
      { projections: aCatalogue() },
    );

    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    expect(junction.elevation).toBeNull();
  });

  it("names a junction after its source reference when the source gave no label", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({ junctions: [aJunction({ ref: "7" })] }),
      { projections: aCatalogue() },
    );

    expect(getByLabel(hydraulicModel.assets, "7")).toBeDefined();
  });

  it("keeps labels unique when the source repeats one", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: [
          aJunction({ ref: "1", label: "DUPLICATE" }),
          aJunction({ ref: "2", label: "DUPLICATE" }),
        ],
      }),
      { projections: aCatalogue() },
    );

    const labels = [...hydraulicModel.assets.values()].map((a) => a.label);
    expect(labels).toEqual(["DUPLICATE", "2"]);
  });

  it("reprojects coordinates with the projection the source coordinate system names", () => {
    const { hydraulicModel, projectSettings } = buildModel(
      aNetwork({
        junctions: [
          aJunction({ ref: "1", label: "J1", coordinates: [1113194.9, 0] }),
        ],
        crs: { type: "epsg", code: 3857 },
      }),
      { projections: aCatalogue() },
    );

    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    expect(junction.coordinates[0]).toBeCloseTo(10, 5);
    expect(junction.coordinates[1]).toBeCloseTo(0, 5);
    expect(projectSettings.projection).toEqual(webMercator);
  });

  it("keeps coordinates as they are when the source named no coordinate system", () => {
    const { projectSettings } = buildModel(
      aNetwork({ junctions: [aJunction({ ref: "1", label: "J1" })] }),
      { projections: aCatalogue() },
    );

    expect(projectSettings.projection).toEqual(WGS84);
  });

  it("keeps coordinates as they are when the code is not in the catalogue", () => {
    const { projectSettings } = buildModel(
      aNetwork({ crs: { type: "epsg", code: 32129 } }),
      { projections: aCatalogue() },
    );

    expect(projectSettings.projection).toEqual(WGS84);
  });

  it("reports the bounds of what it built, in wgs84", () => {
    const { bounds } = buildModel(
      aNetwork({
        junctions: [
          aJunction({ ref: "1", coordinates: [10, 20] }),
          aJunction({ ref: "2", coordinates: [12, 24] }),
        ],
      }),
      { projections: aCatalogue() },
    );

    expect(bounds.extract()).toEqual([10, 20, 12, 24]);
  });

  it("reports no bounds when the source had nothing to build", () => {
    const { bounds } = buildModel(aNetwork(), {
      projections: aCatalogue(),
    });

    expect(bounds.isNothing()).toBe(true);
  });

  it("indexes every junction it builds", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({ junctions: [aJunction({ ref: "1", label: "J1" })] }),
      { projections: aCatalogue() },
    );

    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    expect(hydraulicModel.assetIndex.hasNode(junction.id)).toBe(true);
  });
});

describe("build model unit system", () => {
  it("takes the unit system from the flow unit the source declared", () => {
    const { projectSettings } = buildModel(
      aNetwork({ units: { flow: "gal/min" } }),
      { projections: aCatalogue() },
    );

    expect(projectSettings.units.flow).toEqual("gal/min");
    expect(projectSettings.units.elevation).toEqual("ft");
  });

  it("falls back to litres per second when the source declared no flow unit", () => {
    const { projectSettings } = buildModel(aNetwork({ units: {} }), {
      projections: aCatalogue(),
    });

    expect(projectSettings.units.flow).toEqual("l/s");
    expect(projectSettings.units.elevation).toEqual("m");
  });

  it("falls back to litres per second for a flow unit epanet cannot express", () => {
    const { projectSettings } = buildModel(
      aNetwork({ units: { flow: "l/d" } }),
      { projections: aCatalogue() },
    );

    expect(projectSettings.units.flow).toEqual("l/s");
  });

  it("keeps the pressure unit the source declared", () => {
    const { projectSettings } = buildModel(
      aNetwork({ units: { flow: "l/s", pressure: "bar" } }),
      { projections: aCatalogue() },
    );

    expect(projectSettings.units.pressure).toEqual("bar");
  });

  it("converts elevations when the source states a different unit", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: [aJunction({ ref: "1", label: "J1", elevation: 10 })],
        units: { flow: "l/s", elevation: "ft" },
      }),
      { projections: aCatalogue() },
    );

    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    expect(junction.elevation).toBeCloseTo(3.048, 3);
  });

  it("leaves elevations alone when the source unit already matches", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: [aJunction({ ref: "1", label: "J1", elevation: 10 })],
        units: { flow: "l/s", elevation: "m" },
      }),
      { projections: aCatalogue() },
    );

    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    expect(junction.elevation).toEqual(10);
  });
});

describe("build pipes from network data", () => {
  const twoJunctions = [
    aJunction({ ref: "1", label: "J1", coordinates: [0, 0] }),
    aJunction({ ref: "2", label: "J2", coordinates: [1, 0] }),
  ];

  it("connects a pipe to the nodes its refs name", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pipes: [aPipe({ ref: "10", label: "P1" })],
      }),
      { projections: aCatalogue() },
    );

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    const start = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const end = getByLabel(hydraulicModel.assets, "J2") as Junction;

    expect(pipe.connections).toEqual([start.id, end.id]);
    expect(hydraulicModel.topology.getNodes(pipe.id)).toEqual([
      start.id,
      end.id,
    ]);
    expect(hydraulicModel.assetIndex.hasLink(pipe.id)).toEqual(true);
  });

  it("runs the polyline through the vertices", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pipes: [
          aPipe({
            ref: "10",
            label: "P1",
            vertices: [
              [0.4, 0.1],
              [0.6, 0.1],
            ],
          }),
        ],
      }),
      { projections: aCatalogue() },
    );

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    expect(pipe.coordinates).toEqual([
      [0, 0],
      [0.4, 0.1],
      [0.6, 0.1],
      [1, 0],
    ]);
  });

  it("keeps the declared length", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pipes: [aPipe({ ref: "10", label: "P1", length: 12.5 })],
        units: { flow: "l/s", length: "m" },
      }),
      { projections: aCatalogue() },
    );

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    expect(pipe.length).toEqual(12.5);
  });

  it("measures the geometry when the source declared no length", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pipes: [aPipe({ ref: "10", label: "P1" })],
        units: { flow: "l/s", length: "m" },
      }),
      { projections: aCatalogue() },
    );

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    expect(pipe.length).toBeCloseTo(111195, 0);
  });

  it("converts the diameter into the project unit", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pipes: [aPipe({ ref: "10", label: "P1", diameter: 300 })],
        units: { flow: "gal/min", diameter: "mm" },
      }),
      { projections: aCatalogue() },
    );

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    expect(pipe.diameter).toBeCloseTo(11.811, 3);
  });

  it("keeps a stated zero diameter rather than inventing one", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pipes: [aPipe({ ref: "10", label: "P1", diameter: 0 })],
        units: { flow: "l/s", diameter: "mm" },
      }),
      { projections: aCatalogue() },
    );

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    expect(pipe.diameter).toEqual(0);
  });

  it("leaves the diameter blank when the source stated none", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pipes: [aPipe({ ref: "10", label: "P1" })],
        units: { flow: "l/s", diameter: "mm" },
      }),
      { projections: aCatalogue() },
    );

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    expect(pipe.diameter).toBeNull();
  });

  it("drops a pipe whose endpoint is not in the model", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pipes: [aPipe({ ref: "10", label: "P1", endNodeRef: "404" })],
      }),
      { projections: aCatalogue() },
    );

    expect(hydraulicModel.assets.size).toEqual(2);
  });

  it("carries the inactive flag through", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pipes: [aPipe({ ref: "10", label: "P1", isActive: false })],
      }),
      { projections: aCatalogue() },
    );

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    expect(pipe.isActive).toEqual(false);
  });

  it("lets a pipe and a node share a label", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pipes: [aPipe({ ref: "10", label: "J1" })],
      }),
      { projections: aCatalogue() },
    );

    const labels = [...hydraulicModel.assets.values()].map((a) => a.label);
    expect(labels).toEqual(["J1", "J2", "J1"]);
  });
});

describe("headloss formula", () => {
  const twoJunctions = [
    aJunction({ ref: "1", label: "J1", coordinates: [0, 0] }),
    aJunction({ ref: "2", label: "J2", coordinates: [1, 0] }),
  ];

  it("adopts the formula the network states", () => {
    const { projectSettings } = buildModel(
      aNetwork({ headlossFormula: "D-W" }),
      { projections: aCatalogue() },
    );

    expect(projectSettings.headlossFormula).toEqual("D-W");
    expect(projectSettings.defaults.pipe.roughness).toEqual(0.1);
  });

  it("falls back to hazen williams when the network states none", () => {
    const { projectSettings } = buildModel(aNetwork(), {
      projections: aCatalogue(),
    });

    expect(projectSettings.headlossFormula).toEqual("H-W");
    expect(projectSettings.defaults.pipe.roughness).toEqual(130);
  });

  it("leaves the roughness blank when the source stated none", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pipes: [aPipe({ ref: "10", label: "P1" })],
        headlossFormula: "D-W",
      }),
      { projections: aCatalogue() },
    );

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    expect(pipe.roughness).toBeNull();
  });

  it("keeps a stated roughness", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pipes: [aPipe({ ref: "10", label: "P1", roughness: 0.7 })],
        headlossFormula: "D-W",
      }),
      { projections: aCatalogue() },
    );

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    expect(pipe.roughness).toEqual(0.7);
  });
});

const aPipe = (data: Partial<PipeData> & { ref: string }): PipeData => ({
  startNodeRef: "1",
  endNodeRef: "2",
  ...data,
});

describe("build demands from network data", () => {
  it("assigns a junction its demands, with the pattern each names", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: [
          aJunction({
            ref: "1",
            label: "J1",
            demands: [
              { baseDemand: 24, patternRef: "7" },
              { baseDemand: 0.07 },
            ],
          }),
        ],
        patterns: [{ ref: "7", label: "DOM1", multipliers: [1, 0.5] }],
        units: { flow: "l/s" },
      }),
      { projections: aCatalogue() },
    );

    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const demands = hydraulicModel.demands.junctions.get(junction.id);
    const [pattern] = [...hydraulicModel.patterns.values()];

    expect(pattern).toEqual({
      id: pattern.id,
      label: "DOM1",
      type: "demand",
      multipliers: [1, 0.5],
    });
    expect(demands).toEqual([
      { baseDemand: 24, patternId: pattern.id },
      { baseDemand: 0.07 },
    ]);
  });

  it("converts a base demand into the project's flow unit", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: [
          aJunction({ ref: "1", label: "J1", demands: [{ baseDemand: 3600 }] }),
        ],
        units: { flow: "l/h" },
      }),
      { projections: aCatalogue() },
    );

    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    expect(
      hydraulicModel.demands.junctions.get(junction.id)?.[0].baseDemand,
    ).toBeCloseTo(1, 9);
  });

  it("leaves a junction with no demands when the source stated none", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({ junctions: [aJunction({ ref: "1", label: "J1" })] }),
      { projections: aCatalogue() },
    );

    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    expect(hydraulicModel.demands.junctions.get(junction.id)).toEqual([]);
    expect(hydraulicModel.patterns.size).toEqual(0);
  });
});

describe("build pumps and valves from network data", () => {
  const twoJunctions = [
    aJunction({ ref: "1", label: "J1", coordinates: [0, 0] }),
    aJunction({ ref: "2", label: "J2", coordinates: [1, 0] }),
  ];

  it("gives a pipe the material the source stated", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: [
          aJunction({ ref: "1", label: "J1", coordinates: [0, 0] }),
          aJunction({ ref: "2", label: "J2", coordinates: [1, 0] }),
        ],
        pipes: [aPipe({ ref: "10", label: "P1", material: "HPPE / PE100" })],
      }),
      { projections: aCatalogue() },
    );

    const pipe = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    expect(pipe.material).toEqual("HPPE / PE100");
  });

  it("connects a pump into the network", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pumps: [aPump({ ref: "10", label: "PU1", speed: 0.5 })],
      }),
      { projections: aCatalogue() },
    );

    const pump = getByLabel(hydraulicModel.assets, "PU1") as Pump;
    const start = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const end = getByLabel(hydraulicModel.assets, "J2") as Junction;

    expect(pump.type).toEqual("pump");
    expect(pump.speed).toEqual(0.5);
    expect(hydraulicModel.topology.getNodes(pump.id)).toEqual([
      start.id,
      end.id,
    ]);
    expect(hydraulicModel.assetIndex.hasLink(pump.id)).toEqual(true);
  });

  it("connects a valve into the network", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        valves: [aValve({ ref: "10", label: "V1", kind: "tcv" })],
      }),
      { projections: aCatalogue() },
    );

    const valve = getByLabel(hydraulicModel.assets, "V1") as Valve;
    expect(valve.type).toEqual("valve");
    expect(valve.kind).toEqual("tcv");
    expect(hydraulicModel.assetIndex.hasLink(valve.id)).toEqual(true);
  });

  it("falls back to a throttle valve when the source kind is unknown", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        valves: [aValve({ ref: "10", label: "V1", kind: "unknown" })],
      }),
      { projections: aCatalogue() },
    );

    const valve = getByLabel(hydraulicModel.assets, "V1") as Valve;
    expect(valve.kind).toEqual("tcv");
  });

  it("gives a pump the curve it names, converted into the project's units", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pumps: [aPump({ ref: "10", label: "PU1", curveRef: "13" })],
        curves: [
          {
            ref: "13",
            label: "PMPWGTE1",
            points: [
              { x: 10, y: 128 },
              { x: 40, y: 126 },
            ],
          },
        ],
        units: { flow: "l/s", elevation: "m" },
      }),
      { projections: aCatalogue() },
    );

    const pump = getByLabel(hydraulicModel.assets, "PU1") as Pump;
    const curve = hydraulicModel.curves.get(pump.curveId as number);

    expect(pump.definitionType).toEqual("curveId");
    expect(curve).toEqual({
      id: pump.curveId,
      label: "PMPWGTE1",
      type: "pump",
      points: [
        { x: 10, y: 128 },
        { x: 40, y: 126 },
      ],
    });
  });

  it("falls back to the curve's own ref when the source states no label", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pumps: [aPump({ ref: "10", label: "PU1", curveRef: "13" })],
        curves: [{ ref: "13", points: [{ x: 10, y: 128 }] }],
      }),
      { projections: aCatalogue() },
    );

    const pump = getByLabel(hydraulicModel.assets, "PU1") as Pump;
    const curve = hydraulicModel.curves.get(pump.curveId as number);

    expect(curve?.label).toEqual("13");
  });

  it("gives a pump the speed pattern it names", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pumps: [
          aPump({
            ref: "10",
            label: "PU1",
            speed: 1,
            speedPatternRef: "speed:10",
          }),
        ],
        patterns: [
          { ref: "speed:10", label: "BRANTWB_PS", multipliers: [0.73, 0.67] },
        ],
      }),
      { projections: aCatalogue() },
    );

    const pump = getByLabel(hydraulicModel.assets, "PU1") as Pump;
    const pattern = hydraulicModel.patterns.get(pump.speedPatternId as number);

    expect(pump.speed).toEqual(1);
    expect(pattern).toEqual({
      id: pump.speedPatternId,
      label: "BRANTWB_PS",
      type: "pumpSpeed",
      multipliers: [0.73, 0.67],
    });
  });

  it("shares one curve between the pumps that name it", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pumps: [
          aPump({ ref: "10", label: "PU1", curveRef: "13" }),
          aPump({ ref: "11", label: "PU2", curveRef: "13" }),
        ],
        curves: [{ ref: "13", points: [{ x: 10, y: 128 }] }],
      }),
      { projections: aCatalogue() },
    );

    const first = getByLabel(hydraulicModel.assets, "PU1") as Pump;
    const second = getByLabel(hydraulicModel.assets, "PU2") as Pump;

    expect(first.curveId).toEqual(second.curveId);
    expect(hydraulicModel.curves.size).toEqual(1);
  });

  it("leaves a pump on its default definition when it names no curve", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pumps: [aPump({ ref: "10", label: "PU1" })],
      }),
      { projections: aCatalogue() },
    );

    const pump = getByLabel(hydraulicModel.assets, "PU1") as Pump;
    expect(pump.curveId).toBeNull();
    expect(hydraulicModel.curves.size).toEqual(0);
  });

  it("leaves a pump and a valve blank where the source said nothing", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        pumps: [aPump({ ref: "10", label: "PU1" })],
        valves: [aValve({ ref: "11", label: "V1", kind: "tcv" })],
      }),
      { projections: aCatalogue() },
    );

    const pump = getByLabel(hydraulicModel.assets, "PU1") as Pump;
    const valve = getByLabel(hydraulicModel.assets, "V1") as Valve;
    expect(pump.power).toBeNull();
    expect(valve.setting).toBeNull();
    expect(valve.diameter).toBeNull();
  });

  it("runs a valve polyline through its vertices", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        valves: [
          aValve({
            ref: "10",
            label: "V1",
            kind: "tcv",
            vertices: [[0.5, 0.2]],
          }),
        ],
      }),
      { projections: aCatalogue() },
    );

    const valve = getByLabel(hydraulicModel.assets, "V1") as Valve;
    expect(valve.coordinates).toEqual([
      [0, 0],
      [0.5, 0.2],
      [1, 0],
    ]);
  });

  it("drops a valve whose endpoint is not in the model", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        valves: [
          aValve({ ref: "10", label: "V1", kind: "tcv", endNodeRef: "404" }),
        ],
      }),
      { projections: aCatalogue() },
    );

    expect(hydraulicModel.assets.size).toEqual(2);
  });
});

describe("valve setting units", () => {
  const twoJunctions = [
    aJunction({ ref: "1", label: "J1", coordinates: [0, 0] }),
    aJunction({ ref: "2", label: "J2", coordinates: [1, 0] }),
  ];

  const settingOf = (
    kind: ValveData["kind"],
    setting: number,
    units: NetworkData["units"],
  ) => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: twoJunctions,
        valves: [aValve({ ref: "10", label: "V1", kind, setting })],
        units,
      }),
      { projections: aCatalogue() },
    );

    return (getByLabel(hydraulicModel.assets, "V1") as Valve).setting;
  };

  it("keeps a pressure regulator setting in the source pressure unit", () => {
    expect(settingOf("prv", 10, { flow: "gal/min", pressure: "mwc" })).toEqual(
      10,
    );
  });

  it("keeps a flow regulator setting in the source flow unit", () => {
    expect(settingOf("fcv", 100, { flow: "gal/min" })).toEqual(100);
  });

  it("converts a flow regulator setting when the project cannot adopt the source flow unit", () => {
    expect(settingOf("fcv", 100, { flow: "l/h" })).toBeCloseTo(0.0278, 4);
  });

  it("leaves a throttle valve setting unconverted", () => {
    expect(
      settingOf("tcv", 3600, { flow: "gal/min", pressure: "mwc" }),
    ).toEqual(3600);
  });
});

const aPump = (data: Partial<PumpData> & { ref: string }): PumpData => ({
  startNodeRef: "1",
  endNodeRef: "2",
  ...data,
});

const aValve = (
  data: Partial<ValveData> & { ref: string; kind: ValveData["kind"] },
): ValveData => ({
  startNodeRef: "1",
  endNodeRef: "2",
  ...data,
});

const aReservoir = (
  data: Partial<ReservoirData> & { ref: string },
): ReservoirData => ({
  coordinates: [10, 20],
  ...data,
});

const aTank = (data: Partial<TankData> & { ref: string }): TankData => ({
  coordinates: [10, 20],
  ...data,
});

describe("build reservoirs from network data", () => {
  it("builds a reservoir with its head and elevation", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        reservoirs: [
          aReservoir({ ref: "1", label: "R1", elevation: 50, head: 100 }),
        ],
      }),
      { projections: aCatalogue() },
    );

    const reservoir = getByLabel(hydraulicModel.assets, "R1") as Reservoir;
    expect(reservoir.type).toEqual("reservoir");
    expect(reservoir.elevation).toEqual(50);
    expect(reservoir.head).toEqual(100);
  });

  it("leaves the head blank when the source did not state one", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        reservoirs: [aReservoir({ ref: "1", label: "R1", elevation: 50 })],
        units: { flow: "l/s" },
      }),
      { projections: aCatalogue() },
    );

    const reservoir = getByLabel(hydraulicModel.assets, "R1") as Reservoir;
    expect(reservoir.head).toBeNull();
  });

  it("converts the head into the project unit", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        reservoirs: [aReservoir({ ref: "1", label: "R1", head: 10 })],
        units: { flow: "l/s", elevation: "ft" },
      }),
      { projections: aCatalogue() },
    );

    const reservoir = getByLabel(hydraulicModel.assets, "R1") as Reservoir;
    expect(reservoir.head).toBeCloseTo(3.048, 3);
  });

  it("gives a reservoir the head pattern it names", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        reservoirs: [
          aReservoir({
            ref: "1",
            label: "R1",
            head: 1,
            headPatternRef: "head:1",
          }),
        ],
        patterns: [
          { ref: "head:1", label: "SPWCOM1", multipliers: [70, 71, 72] },
        ],
      }),
      { projections: aCatalogue() },
    );

    const reservoir = getByLabel(hydraulicModel.assets, "R1") as Reservoir;
    const pattern = hydraulicModel.patterns.get(
      reservoir.headPatternId as number,
    );

    expect(reservoir.head).toEqual(1);
    expect(pattern).toEqual({
      id: reservoir.headPatternId,
      label: "SPWCOM1",
      type: "reservoirHead",
      multipliers: [70, 71, 72],
    });
  });

  it("indexes the reservoir as a node", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({ reservoirs: [aReservoir({ ref: "1", label: "R1" })] }),
      { projections: aCatalogue() },
    );

    const reservoir = getByLabel(hydraulicModel.assets, "R1") as Reservoir;
    expect(hydraulicModel.assetIndex.hasNode(reservoir.id)).toEqual(true);
  });
});

describe("build tanks from network data", () => {
  it("builds a tank with its levels and diameter", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        tanks: [
          aTank({
            ref: "1",
            label: "T1",
            elevation: 77,
            minLevel: 2,
            initialLevel: 12,
            maxLevel: 20,
            diameter: 10,
          }),
        ],
        units: {
          flow: "l/s",
          elevation: "m",
          level: "m",
          diameter: "mm",
          tankDiameter: "m",
        },
      }),
      { projections: aCatalogue() },
    );

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.type).toEqual("tank");
    expect(tank.elevation).toEqual(77);
    expect(tank.minLevel).toEqual(2);
    expect(tank.initialLevel).toEqual(12);
    expect(tank.maxLevel).toEqual(20);
    expect(tank.diameter).toEqual(10);
  });

  it("gives a tank the volume curve it names, in the project's units", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        tanks: [aTank({ ref: "1", label: "T1", volumeCurveRef: "51" })],
        curves: [
          {
            ref: "51",
            label: "TK_VOL",
            points: [
              { x: 0, y: 0 },
              { x: 1140, y: 3 },
            ],
          },
        ],
        units: { volume: "m^3", level: "m" },
      }),
      { projections: aCatalogue() },
    );

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    const curve = hydraulicModel.curves.get(tank.volumeCurveId as number);

    expect(curve).toEqual({
      id: tank.volumeCurveId,
      label: "TK_VOL",
      type: "volume",
      points: [
        { x: 0, y: 0 },
        { x: 1140, y: 3 },
      ],
    });
  });

  it("converts a volume curve through the volume and level units", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        tanks: [aTank({ ref: "1", label: "T1", volumeCurveRef: "51" })],
        curves: [{ ref: "51", points: [{ x: 1, y: 1 }] }],
        units: { volume: "ft^3", level: "ft" },
      }),
      { projections: aCatalogue() },
    );

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    const curve = hydraulicModel.curves.get(tank.volumeCurveId as number);

    expect(curve?.points[0].x).toBeCloseTo(0.0283168, 6);
    expect(curve?.points[0].y).toBeCloseTo(0.3048, 6);
  });

  it("reads a tank diameter in its own unit, not the one pipes are in", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        tanks: [aTank({ ref: "1", label: "T1", diameter: 100 })],
        units: { diameter: "mm", tankDiameter: "ft" },
      }),
      { projections: aCatalogue() },
    );

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.diameter).toBeCloseTo(30.48, 6);
  });

  it("leaves the levels blank when the source stated none", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        tanks: [aTank({ ref: "1", label: "T1" })],
        units: { flow: "l/s" },
      }),
      { projections: aCatalogue() },
    );

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.minLevel).toBeNull();
    expect(tank.initialLevel).toBeNull();
    expect(tank.maxLevel).toBeNull();
    expect(tank.diameter).toBeNull();
  });

  it("keeps a stated zero diameter rather than inventing one", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        tanks: [aTank({ ref: "1", label: "T1", diameter: 0 })],
        units: { flow: "l/s", diameter: "mm" },
      }),
      { projections: aCatalogue() },
    );

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.diameter).toEqual(0);
  });

  it("keeps a stated initial level with no max level to hold it", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        tanks: [aTank({ ref: "1", label: "T1", initialLevel: 60 })],
        units: { flow: "l/s" },
      }),
      { projections: aCatalogue() },
    );

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.initialLevel).toEqual(60);
    expect(tank.maxLevel).toBeNull();
  });

  it("indexes the tank as a node", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({ tanks: [aTank({ ref: "1", label: "T1" })] }),
      { projections: aCatalogue() },
    );

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(hydraulicModel.assetIndex.hasNode(tank.id)).toEqual(true);
  });
});

describe("build controls from network data", () => {
  const aPumpedTank = {
    junctions: [aJunction({ ref: "1", label: "J1", coordinates: [0, 0] })],
    tanks: [aTank({ ref: "2", label: "T1", coordinates: [1, 0] })],
    pumps: [
      aPump({ ref: "10", label: "PU1", startNodeRef: "1", endNodeRef: "2" }),
    ],
  };

  it("gives the pump the tank level control the source stated", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({ ...aPumpedTank, controls: [aTankLevelControl()] }),
      { projections: aCatalogue() },
    );

    const pump = getByLabel(hydraulicModel.assets, "PU1") as Pump;
    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    const [control] = hydraulicModel.controls as LevelSettingControl[];

    expect(control.type).toEqual("level-setting");
    expect(control.linkId).toEqual(pump.id);
    expect(control.tankId).toEqual(tank.id);
    expect(control.on).toEqual({ level: 7.12, setting: 0.8113 });
    expect(control.off).toEqual({ level: 7.92 });
  });

  it("finds the control from both the pump and the tank", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({ ...aPumpedTank, controls: [aTankLevelControl()] }),
      { projections: aCatalogue() },
    );

    const pump = getByLabel(hydraulicModel.assets, "PU1") as Pump;
    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;

    expect([...hydraulicModel.controlsLookup.getControls(pump.id)]).toEqual(
      hydraulicModel.controls,
    );
    expect([...hydraulicModel.controlsLookup.getControls(tank.id)]).toEqual(
      hydraulicModel.controls,
    );
  });

  it("converts the levels into the project's units", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        ...aPumpedTank,
        controls: [aTankLevelControl()],
        units: { flow: "gal/min", level: "m" },
      }),
      { projections: aCatalogue() },
    );

    const [control] = hydraulicModel.controls as LevelSettingControl[];
    expect(control.on.level).toBeCloseTo(23.3596, 3);
    expect(control.off.level).toBeCloseTo(25.9843, 3);
    expect(control.on.setting).toEqual(0.8113);
  });

  it("drops a control naming an asset that never arrived", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        ...aPumpedTank,
        controls: [
          aTankLevelControl({ linkRef: "404" }),
          aTankLevelControl({ tankRef: "404" }),
        ],
      }),
      { projections: aCatalogue() },
    );

    const pump = getByLabel(hydraulicModel.assets, "PU1") as Pump;
    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;

    expect(hydraulicModel.controls).toEqual([]);
    expect(hydraulicModel.controlsLookup.hasControls(pump.id)).toEqual(false);
    expect(hydraulicModel.controlsLookup.hasControls(tank.id)).toEqual(false);
  });

  it("leaves the controls empty when the source states none", () => {
    const { hydraulicModel } = buildModel(aNetwork(aPumpedTank), {
      projections: aCatalogue(),
    });

    expect(hydraulicModel.controls).toEqual([]);
  });
});

describe("labels across node kinds", () => {
  it("keeps labels unique when kinds collide", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        junctions: [aJunction({ ref: "1", label: "SHARED" })],
        reservoirs: [aReservoir({ ref: "2", label: "SHARED" })],
        tanks: [aTank({ ref: "3", label: "SHARED" })],
      }),
      { projections: aCatalogue() },
    );

    const labels = [...hydraulicModel.assets.values()].map((a) => a.label);
    expect(labels).toEqual(["SHARED", "2", "3"]);
  });
});

const aJunction = (
  data: Partial<JunctionData> & { ref: string },
): JunctionData => ({
  coordinates: [10, 20],
  ...data,
});

const aTankLevelControl = (data: Partial<ControlData> = {}): ControlData => ({
  type: "tankLevel",
  linkRef: "10",
  tankRef: "2",
  on: { level: 7.12, setting: 0.8113 },
  off: { level: 7.92 },
  ...data,
});

const aNetwork = (data: Partial<NetworkData> = {}): NetworkData => ({
  junctions: [],
  reservoirs: [],
  tanks: [],
  pipes: [],
  pumps: [],
  valves: [],
  curves: [],
  patterns: [],
  controls: [],
  units: {},
  crs: { type: "unknown" },
  ...data,
});
