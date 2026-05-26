import { describe, it, expect } from "vitest";
import { readZoneFeatures } from "./read-zone-features";

const fileFrom = (content: string, name = "test.geojson") =>
  new File([content], name, { type: "application/json" });

describe("readZoneFeatures", () => {
  it("returns polygon features and unique properties", async () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          },
          properties: { name: "Zone A", region: "north" },
        },
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [2, 2],
                [3, 2],
                [3, 3],
                [2, 2],
              ],
            ],
          },
          properties: { name: "Zone B", priority: 1 },
        },
      ],
    };

    const result = await readZoneFeatures(fileFrom(JSON.stringify(geojson)));

    expect(result.error).toBeUndefined();
    expect(result.features).toHaveLength(2);
    expect(result.uniqueProperties).toEqual(
      new Set(["name", "region", "priority"]),
    );
  });

  it("accepts MultiPolygon geometries", async () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            ],
          },
          properties: { id: 1 },
        },
      ],
    };

    const result = await readZoneFeatures(fileFrom(JSON.stringify(geojson)));

    expect(result.error).toBeUndefined();
    expect(result.features).toHaveLength(1);
  });

  it("filters out non-polygon geometries", async () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: { pointProp: "a" },
        },
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          },
          properties: { polyProp: "b" },
        },
      ],
    };

    const result = await readZoneFeatures(fileFrom(JSON.stringify(geojson)));

    expect(result.error).toBeUndefined();
    expect(result.features).toHaveLength(1);
    expect(result.uniqueProperties).toEqual(new Set(["polyProp"]));
  });

  it("returns noPolygons error when no polygon geometries exist", async () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: {},
        },
      ],
    };

    const result = await readZoneFeatures(fileFrom(JSON.stringify(geojson)));

    expect(result.error).toBe("noPolygons");
    expect(result.features).toHaveLength(0);
  });

  it("returns invalidFile error for non-JSON content", async () => {
    const result = await readZoneFeatures(fileFrom("not json"));

    expect(result.error).toBe("invalidFile");
    expect(result.features).toHaveLength(0);
  });

  it("returns invalidFile error for JSON that is not a FeatureCollection", async () => {
    const result = await readZoneFeatures(
      fileFrom(JSON.stringify({ type: "Feature", geometry: null })),
    );

    expect(result.error).toBe("invalidFile");
    expect(result.features).toHaveLength(0);
  });

  it("collects properties only from polygon features", async () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
          properties: { lineProp: "x" },
        },
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          },
          properties: { zoneProp: "y" },
        },
      ],
    };

    const result = await readZoneFeatures(fileFrom(JSON.stringify(geojson)));

    expect(result.uniqueProperties).toEqual(new Set(["zoneProp"]));
    expect(result.uniqueProperties.has("lineProp")).toBe(false);
  });
});
