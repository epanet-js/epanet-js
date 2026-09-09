import type { Feature, Position } from "geojson";
import { readZonesWithImporter } from "./read-zones";

const aSquare = (x: number, y: number, size: number): Position[] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

const aZone = (
  ring: Position[],
  properties: Record<string, unknown>,
): Feature => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [ring] },
  properties,
});

const aPoint = (coordinates: Position): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties: {},
});

const aFile = (features: Feature[], crs?: unknown) =>
  new File(
    [
      JSON.stringify({
        type: "FeatureCollection",
        ...(crs === undefined ? {} : { crs }),
        features,
      }),
    ],
    "zones.geojson",
    { type: "application/json" },
  );

const georeferenced = { isUnprojected: false };
const unprojected = { isUnprojected: true };

describe("readZonesWithImporter", () => {
  it("reads the polygons and the properties to map", async () => {
    const result = await readZonesWithImporter(
      {
        geojson: aFile([
          aZone(aSquare(0.001, 0.001, 0.001), { DMA: "North" }),
          aZone(aSquare(0.003, 0.003, 0.001), { DMA: "South" }),
        ]),
      },
      georeferenced,
    );

    expect(result.error).toBeUndefined();
    expect(result.features).toHaveLength(2);
    expect([...result.uniqueProperties]).toEqual(["DMA"]);
  });

  it("keeps only the polygons of a mixed file", async () => {
    const result = await readZonesWithImporter(
      {
        geojson: aFile([
          aPoint([0.001, 0.001]),
          aZone(aSquare(0.001, 0.001, 0.001), { DMA: "North" }),
        ]),
      },
      georeferenced,
    );

    expect(result.features).toHaveLength(1);
  });

  it("reports a file with no polygons at all", async () => {
    const result = await readZonesWithImporter(
      { geojson: aFile([aPoint([0.001, 0.001])]) },
      georeferenced,
    );

    expect(result.error).toBe("noPolygons");
  });

  it("refuses local coordinates in a georeferenced project", async () => {
    const result = await readZonesWithImporter(
      { geojson: aFile([aZone(aSquare(432000, 5812000, 100), {})]) },
      georeferenced,
    );

    expect(result.error).toBe("invalidProjection");
  });

  it("accepts those same coordinates in a project that is not georeferenced", async () => {
    const result = await readZonesWithImporter(
      {
        geojson: aFile([
          aZone(aSquare(432000, 5812000, 100), { DMA: "North" }),
        ]),
      },
      unprojected,
    );

    expect(result.error).toBeUndefined();
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.coordinates).toEqual([
      aSquare(432000, 5812000, 100),
    ]);
  });

  it("refuses a CRS it has no definition for, wherever it lands", async () => {
    const stated = {
      type: "name",
      properties: { name: "EPSG:27700" },
    };

    const result = await readZonesWithImporter(
      { geojson: aFile([aZone(aSquare(432000, 181000, 100), {})], stated) },
      unprojected,
    );

    expect(result.error).toBe("unsupportedProjection");
  });

  it("reports a file it could not read", async () => {
    const broken = new File(["{"], "zones.geojson", {
      type: "application/json",
    });

    const result = await readZonesWithImporter(
      { geojson: broken },
      georeferenced,
    );

    expect(result.error).toBe("invalidFile");
  });
});
