import { parseInp } from "./parse-inp";
import { buildInp } from "src/simulation/build-inp";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { presets } from "src/lib/project-settings/quantities-spec";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { WGS84 } from "src/lib/projections";
import type { Proj4Projection, XYGridProjection } from "src/lib/projections";

const IDS = { J1: 1, J2: 2, P1: 3 } as const;

const buildTestModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { coordinates: [10, 20] })
    .aJunction(IDS.J2, { coordinates: [11, 21] })
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
    .build();

const buildOptions = (
  projection: Parameters<typeof buildInp>[1]["projection"],
) => ({
  simulationSettings: defaultSimulationSettings,
  units: presets.LPS.units,
  headlossFormula: "H-W" as const,
  madeBy: true,
  geolocation: true,
  projection,
});

describe("projection round-trip through INP header", () => {
  it("round-trips proj4 projection metadata", () => {
    const projection: Proj4Projection = {
      type: "proj4",
      id: "EPSG:2154",
      name: "RGF93 / Lambert-93",
      code: "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs",
    };

    const model = buildTestModel();
    const inp = buildInp(model, buildOptions(projection));
    const result = parseInp(inp);

    expect(result.isMadeByApp).toBe(true);
    expect(result.projectSettings.projection.type).toBe("proj4");

    const parsed = result.projectSettings.projection as Proj4Projection;
    expect(parsed.id).toBe("EPSG:2154");
    expect(parsed.name).toBe("RGF93 / Lambert-93");
    expect(parsed.code).toBe(projection.code);
  });

  it("round-trips xy-grid projection", () => {
    const projection: XYGridProjection = {
      type: "xy-grid",
      id: "xy-grid",
      name: "XY Grid",
      centroid: [500000, 200000],
    };

    const model = buildTestModel();
    const inp = buildInp(model, buildOptions(projection));
    const result = parseInp(inp);

    expect(result.isMadeByApp).toBe(true);
    expect(result.projectSettings.projection.type).toBe("xy-grid");
  });

  it("round-trips wgs84 with no projection header", () => {
    const model = buildTestModel();
    const inp = buildInp(model, buildOptions(WGS84));
    const result = parseInp(inp);

    expect(result.isMadeByApp).toBe(true);
    expect(result.projectSettings.projection.type).toBe("wgs84");
  });
});

describe("xy-grid detection via pipe length sanity check", () => {
  const buildInpWith = ({
    units,
    startCoord,
    endCoord,
    pipeLength,
  }: {
    units: "LPS" | "GPM";
    startCoord: [number, number];
    endCoord: [number, number];
    pipeLength: number;
  }) => `
    [OPTIONS]
    Units\t${units}
    [JUNCTIONS]
    J1\t0
    J2\t0
    [PIPES]
    P1\tJ1\tJ2\t${pipeLength}\t100\t0
    [COORDINATES]
    J1\t${startCoord[0]}\t${startCoord[1]}
    J2\t${endCoord[0]}\t${endCoord[1]}
    `;

  it("flags XY grid masquerading as WGS84 when flag is on", () => {
    const inp = buildInpWith({
      units: "LPS",
      startCoord: [0, 0],
      endCoord: [0.5, 0],
      pipeLength: 100,
    });

    const result = parseInp(inp, { xyDetect: true });

    expect(result.projectionStatus).toBe("unknown");
  });

  it("accepts real WGS84 when declared lengths match geodesic", () => {
    const inp = buildInpWith({
      units: "LPS",
      startCoord: [2.3, 48.85],
      endCoord: [2.31, 48.85],
      pipeLength: 730,
    });

    const result = parseInp(inp, { xyDetect: true });

    expect(result.projectionStatus).toBe("wgs84");
  });

  it("preserves WGS84 verdict when flag is off", () => {
    const inp = buildInpWith({
      units: "LPS",
      startCoord: [0, 0],
      endCoord: [0.5, 0],
      pipeLength: 100,
    });

    const result = parseInp(inp, { xyDetect: false });

    expect(result.projectionStatus).toBe("wgs84");
  });

  it("falls back to WGS84 when pipes have no usable length", () => {
    const inp = buildInpWith({
      units: "LPS",
      startCoord: [0, 0],
      endCoord: [0.5, 0],
      pipeLength: 0,
    });

    const result = parseInp(inp, { xyDetect: true });

    expect(result.projectionStatus).toBe("wgs84");
  });

  it("flags XY grid when US-unit lengths are in feet", () => {
    const inp = buildInpWith({
      units: "GPM",
      startCoord: [0, 0],
      endCoord: [0.01, 0],
      pipeLength: 100,
    });

    const result = parseInp(inp, { xyDetect: true });

    expect(result.projectionStatus).toBe("unknown");
  });
});
