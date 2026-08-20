import type {
  JunctionData,
  NetworkData,
  ReservoirData,
  TankData,
} from "@epanet-js/converters";
import { WGS84, type Proj4Projection } from "@epanet-js/projections";
import { Junction, Reservoir, Tank } from "src/hydraulic-model";
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

  it("falls back to the preset head when the source did not state one", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        reservoirs: [aReservoir({ ref: "1", label: "R1", elevation: 50 })],
        units: { flow: "l/s" },
      }),
      { projections: aCatalogue() },
    );

    const reservoir = getByLabel(hydraulicModel.assets, "R1") as Reservoir;
    expect(reservoir.head).toEqual(60);
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
            diameter: 10000,
          }),
        ],
        units: { flow: "l/s", elevation: "m", level: "m", diameter: "mm" },
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

  it("falls back to the preset levels the source did not state", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        tanks: [aTank({ ref: "1", label: "T1" })],
        units: { flow: "l/s" },
      }),
      { projections: aCatalogue() },
    );

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.minLevel).toEqual(0);
    expect(tank.initialLevel).toEqual(10);
    expect(tank.maxLevel).toEqual(35);
    expect(tank.diameter).toEqual(10);
  });

  it("treats a zero diameter as no diameter at all", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        tanks: [aTank({ ref: "1", label: "T1", diameter: 0 })],
        units: { flow: "l/s", diameter: "mm" },
      }),
      { projections: aCatalogue() },
    );

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.diameter).toEqual(10);
  });

  it("raises the max level so it can hold the initial level", () => {
    const { hydraulicModel } = buildModel(
      aNetwork({
        tanks: [aTank({ ref: "1", label: "T1", initialLevel: 60 })],
        units: { flow: "l/s" },
      }),
      { projections: aCatalogue() },
    );

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.initialLevel).toEqual(60);
    expect(tank.maxLevel).toEqual(60);
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

const aNetwork = (data: Partial<NetworkData> = {}): NetworkData => ({
  junctions: [],
  reservoirs: [],
  tanks: [],
  units: {},
  crs: { type: "unknown" },
  ...data,
});
