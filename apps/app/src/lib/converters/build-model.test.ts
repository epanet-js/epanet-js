import type { JunctionData, NetworkData } from "@epanet-js/converters";
import { WGS84, type Proj4Projection } from "@epanet-js/projections";
import { Junction } from "src/hydraulic-model";
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

const aJunction = (
  data: Partial<JunctionData> & { ref: string },
): JunctionData => ({
  coordinates: [10, 20],
  ...data,
});

const aNetwork = (data: Partial<NetworkData> = {}): NetworkData => ({
  junctions: [],
  units: {},
  crs: { type: "unknown" },
  ...data,
});
