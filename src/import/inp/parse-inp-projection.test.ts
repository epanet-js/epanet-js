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
