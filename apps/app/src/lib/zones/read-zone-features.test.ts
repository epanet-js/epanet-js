import { describe, it, expect } from "vitest";
import { readZoneFeatures } from "./read-zone-features";
import type { Proj4Projection } from "src/lib/projections";

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

  it("excludes properties with empty values from uniqueProperties", async () => {
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
          properties: {
            name: "Zone A",
            nullProp: null,
            emptyString: "",
            whitespace: "   ",
            nullBytes: "\0\0\0",
            nullBytesWithSpaces: " \0 ",
            validZero: 0,
            validFalse: false,
          },
        },
      ],
    };

    const result = await readZoneFeatures(fileFrom(JSON.stringify(geojson)));

    expect(result.error).toBeUndefined();
    expect(result.uniqueProperties).toEqual(
      new Set(["name", "validZero", "validFalse"]),
    );
  });

  describe("projection handling", () => {
    it("returns no coordinateConversion when projections are not provided", async () => {
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
            properties: {},
          },
        ],
      };

      const result = await readZoneFeatures(fileFrom(JSON.stringify(geojson)));

      expect(result.error).toBeUndefined();
      expect(result.coordinateConversion).toBeUndefined();
    });

    it("returns no coordinateConversion when GeoJSON has no CRS", async () => {
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
            properties: {},
          },
        ],
      };

      const result = await readZoneFeatures(
        fileFrom(JSON.stringify(geojson)),
        mockProjections,
      );

      expect(result.error).toBeUndefined();
      expect(result.coordinateConversion).toBeUndefined();
    });

    it("detects CRS84 without converting coordinates", async () => {
      const geojson = {
        type: "FeatureCollection",
        crs: {
          type: "name",
          properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
        },
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
            properties: {},
          },
        ],
      };

      const result = await readZoneFeatures(
        fileFrom(JSON.stringify(geojson)),
        mockProjections,
      );

      expect(result.error).toBeUndefined();
      expect(result.coordinateConversion).toEqual({
        detected: "EPSG:4326",
        converted: false,
        fromCRS: "WGS84",
      });
    });

    it("converts coordinates from EPSG:3857 to WGS84", async () => {
      const geojson = {
        type: "FeatureCollection",
        crs: {
          type: "name",
          properties: { name: "urn:ogc:def:crs:EPSG::3857" },
        },
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [111319.49, 0],
                  [111319.49, 111325.14],
                  [0, 0],
                ],
              ],
            },
            properties: { name: "Projected Zone" },
          },
        ],
      };

      const result = await readZoneFeatures(
        fileFrom(JSON.stringify(geojson)),
        mockProjections,
      );

      expect(result.error).toBeUndefined();
      expect(result.features).toHaveLength(1);
      expect(result.coordinateConversion).toEqual({
        detected: "EPSG:3857",
        converted: true,
        fromCRS: "WGS 84 / Pseudo-Mercator",
      });

      const coords = result.features[0].geometry.coordinates;
      const firstRing =
        result.features[0].geometry.type === "Polygon"
          ? coords[0]
          : (coords as number[][][][])[0][0];

      // Verify coordinates were converted to WGS84 range
      for (const coord of firstRing as number[][]) {
        expect(coord[0]).toBeGreaterThanOrEqual(-180);
        expect(coord[0]).toBeLessThanOrEqual(180);
        expect(coord[1]).toBeGreaterThanOrEqual(-90);
        expect(coord[1]).toBeLessThanOrEqual(90);
      }
    });

    it("returns unsupportedProjection error for unknown CRS", async () => {
      const geojson = {
        type: "FeatureCollection",
        crs: {
          type: "name",
          properties: { name: "urn:ogc:def:crs:EPSG::99999" },
        },
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
            properties: {},
          },
        ],
      };

      const result = await readZoneFeatures(
        fileFrom(JSON.stringify(geojson)),
        mockProjections,
      );

      expect(result.error).toBe("unsupportedProjection");
      expect(result.features).toHaveLength(0);
    });

    it("returns invalidProjection error for out-of-bounds WGS84 coordinates", async () => {
      const geojson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [500000, 4500000],
                  [500100, 4500000],
                  [500100, 4500100],
                  [500000, 4500000],
                ],
              ],
            },
            properties: {},
          },
        ],
      };

      const result = await readZoneFeatures(
        fileFrom(JSON.stringify(geojson)),
        mockProjections,
      );

      expect(result.error).toBe("invalidProjection");
      expect(result.features).toHaveLength(0);
    });

    it("flattens MultiPolygon with 3D coordinates (lon, lat, altitude)", async () => {
      const geojson = {
        type: "FeatureCollection",
        crs: {
          type: "name",
          properties: { name: "urn:ogc:def:crs:EPSG::3857" },
        },
        features: [
          {
            type: "Feature",
            geometry: {
              type: "MultiPolygon",
              coordinates: [
                [
                  [
                    [0, 0, 0.0],
                    [111319.49, 0, 0.0],
                    [111319.49, 111325.14, 0.0],
                    [0, 0, 0.0],
                  ],
                ],
              ],
            },
            properties: { name: "Zone 3D" },
          },
        ],
      };

      const result = await readZoneFeatures(
        fileFrom(JSON.stringify(geojson)),
        mockProjections,
      );

      expect(result.error).toBeUndefined();
      expect(result.features).toHaveLength(1);
      expect(result.coordinateConversion?.converted).toBe(true);

      const coords = result.features[0].geometry.coordinates;
      const firstRing =
        result.features[0].geometry.type === "MultiPolygon"
          ? (coords as number[][][][])[0][0]
          : (coords as number[][][])[0];

      for (const coord of firstRing) {
        expect(coord[0]).toBeGreaterThanOrEqual(-180);
        expect(coord[0]).toBeLessThanOrEqual(180);
        expect(coord[1]).toBeGreaterThanOrEqual(-90);
        expect(coord[1]).toBeLessThanOrEqual(90);
        expect(coord[2]).toBeUndefined();
      }
    });

    it("handles null projections parameter like no projections", async () => {
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
            properties: {},
          },
        ],
      };

      const result = await readZoneFeatures(
        fileFrom(JSON.stringify(geojson)),
        null,
      );

      expect(result.error).toBeUndefined();
      expect(result.features).toHaveLength(1);
      expect(result.coordinateConversion).toBeUndefined();
    });
  });
});

const fileFrom = (content: string, name = "test.geojson") => ({
  geojson: new File([content], name, { type: "application/json" }),
});

const mockProjections = new Map<string, Proj4Projection>([
  [
    "EPSG:3857",
    {
      type: "proj4",
      id: "EPSG:3857",
      name: "WGS 84 / Pseudo-Mercator",
      code: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs",
    },
  ],
  [
    "EPSG:4326",
    {
      type: "proj4",
      id: "EPSG:4326",
      name: "WGS 84",
      code: "+proj=longlat +datum=WGS84 +no_defs",
    },
  ],
]);
