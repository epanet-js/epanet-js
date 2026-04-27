import { ExportEntry } from "../types";
import { exportGeoJson } from "./export-geojson";

const emptyGeometry = {
  type: "Point",
  coordinates: [],
};

describe("export-geojson", () => {
  it("appends all object properties as GeoJSON properties", async () => {
    const item = {
      a: 1,
      b: "c",
      c: [1, 2],
    };
    const entry: ExportEntry = {
      format: "geojson",
      data: [item],
      name: "name",
    };

    const [exported] = exportGeoJson(entry);

    const geoJson = JSON.parse(await exported.blob.text());
    expect(geoJson).toMatchObject({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { ...item },
          geometry: emptyGeometry,
        },
      ],
    });
  });

  it("includes geometry if present in object", async () => {
    const itemProps = {
      a: 1,
      b: "c",
      c: [1, 2],
    };
    const itemGeometry = {
      type: "Line",
      coordinates: [0, 1, 2],
    };
    const item = { ...itemProps, geometry: { ...itemGeometry } };
    const entry: ExportEntry = {
      format: "geojson",
      data: [item],
      name: "name",
    };

    const [exported] = exportGeoJson(entry);

    const geoJson = JSON.parse(await exported.blob.text());
    expect(geoJson).toMatchObject({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { ...itemProps },
          geometry: itemGeometry,
        },
      ],
    });
    expect(geoJson.features[0].properties.geometry).not.toBeDefined();
  });
});
