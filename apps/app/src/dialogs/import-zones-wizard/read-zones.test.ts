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

const options = {};

describe("readZonesWithImporter", () => {
  it("reads the polygons and the properties to map", async () => {
    const result = await readZonesWithImporter(
      {
        geojson: aFile([
          aZone(aSquare(0.001, 0.001, 0.001), { DMA: "North" }),
          aZone(aSquare(0.003, 0.003, 0.001), { DMA: "South" }),
        ]),
      },
      options,
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
      options,
    );

    expect(result.features).toHaveLength(1);
  });

  it("reports a file with no polygons at all", async () => {
    const result = await readZonesWithImporter(
      { geojson: aFile([aPoint([0.001, 0.001])]) },
      options,
    );

    expect(result.error).toBe("noPolygons");
  });

  it("refuses coordinates it cannot place, whatever the project", async () => {
    const result = await readZonesWithImporter(
      { geojson: aFile([aZone(aSquare(432000, 5812000, 100), {})]) },
      options,
    );

    expect(result.error).toBe("invalidProjection");
  });

  it("refuses a CRS it has no definition for", async () => {
    const stated = {
      type: "name",
      properties: { name: "EPSG:27700" },
    };

    const result = await readZonesWithImporter(
      { geojson: aFile([aZone(aSquare(432000, 181000, 100), {})], stated) },
      options,
    );

    expect(result.error).toBe("unsupportedProjection");
  });

  it("reports a file it could not read", async () => {
    const broken = new File(["{"], "zones.geojson", {
      type: "application/json",
    });

    const result = await readZonesWithImporter({ geojson: broken }, options);

    expect(result.error).toBe("invalidFile");
  });
});
