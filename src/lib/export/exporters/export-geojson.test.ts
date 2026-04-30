import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ExportedFile } from "../types";
import { exportGeoJson } from "./export-geojson";

describe("export-geojson", () => {
  it("generates a GeoJSON file for each asset type", async () => {
    const model = HydraulicModelBuilder.empty();
    const files = exportGeoJson(model, false);

    for (const file of files) {
      const geoJson = await parseGeoJson(file);
      expect(geoJson.type).toBe("FeatureCollection");
      expect(Array.isArray(geoJson.features)).toBe(true);
      expect(file.extensions).toEqual([".geojson"]);
      expect(file.mimeTypes).toEqual(["text/geo+json"]);
      expect(file.description).toBe("GeoJSON File");
    }
  });

  it("includes asset geometry and properties in the feature", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1", elevation: 10 })
      .build();
    const files = exportGeoJson(model, false);

    const geoJson = await parseGeoJson(findFile(files, "junction.geojson"));

    expect(geoJson.features).toHaveLength(1);
    expect(geoJson.features[0].type).toBe("Feature");
    expect(geoJson.features[0].geometry).toMatchObject({ type: "Point" });
    expect(geoJson.features[0].properties).toMatchObject({
      label: "J1",
      elevation: 10,
    });
  });

  it("separates assets by type into their respective files", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aJunction(2, { label: "J2" })
      .aPipe(3, { startNodeId: 1, endNodeId: 2 })
      .build();
    const files = exportGeoJson(model, false);

    const junctionGeoJson = await parseGeoJson(
      findFile(files, "junction.geojson"),
    );
    const pipeGeoJson = await parseGeoJson(findFile(files, "pipe.geojson"));

    expect(junctionGeoJson.features).toHaveLength(2);
    expect(pipeGeoJson.features).toHaveLength(1);
  });
});

const findFile = (files: ExportedFile[], name: string) =>
  files.find((f) => f.fileName === name)!;

const parseGeoJson = async (file: ExportedFile) =>
  JSON.parse(await file.blob.text()) as {
    type: string;
    features: { type: string; geometry: object; properties: object }[];
  };
