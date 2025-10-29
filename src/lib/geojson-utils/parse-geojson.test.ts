import { parseGeoJson } from "./parse-geojson";
import type { Projection } from "src/hooks/use-projections";

describe("parseGeoJson", () => {
  it("parses valid FeatureCollection", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: { name: "Test Point", demand: 100 },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [1, 1] },
          properties: { name: "Another Point", elevation: 50 },
        },
      ],
    };

    const result = parseGeoJson(JSON.stringify(geojson));

    expect(result.features).toHaveLength(2);
    expect(result.properties).toEqual(new Set(["name", "demand", "elevation"]));
  });

  it("parses valid GeoJSONL format", () => {
    const geojsonl = `
{"type": "Feature", "geometry": {"type": "Point", "coordinates": [0, 0]}, "properties": {"name": "Test", "demand": 100}}
{"type": "Feature", "geometry": {"type": "Point", "coordinates": [1, 1]}, "properties": {"name": "Another", "flow": 200}}
    `.trim();

    const result = parseGeoJson(geojsonl);

    expect(result.features).toHaveLength(2);
    expect(result.properties).toEqual(new Set(["name", "demand", "flow"]));
  });

  it("skips metadata entries in GeoJSONL", () => {
    const geojsonl = `
{"type": "metadata", "version": "1.0"}
{"type": "Feature", "geometry": {"type": "Point", "coordinates": [0, 0]}, "properties": {"name": "Test"}}
    `.trim();

    const result = parseGeoJson(geojsonl);

    expect(result.features).toHaveLength(1);
    expect(result.properties).toEqual(new Set(["name"]));
  });

  it("handles invalid JSON lines gracefully", () => {
    const geojsonl = `
{"type": "Feature", "geometry": {"type": "Point", "coordinates": [0, 0]}, "properties": {"name": "Valid"}}
invalid json line
{"type": "Feature", "geometry": {"type": "Point", "coordinates": [1, 1]}, "properties": {"name": "Also Valid"}}
    `.trim();

    const result = parseGeoJson(geojsonl);

    expect(result.features).toHaveLength(2);
    expect(result.properties).toEqual(new Set(["name"]));
  });

  it("handles empty content", () => {
    const result = parseGeoJson("");

    expect(result.features).toHaveLength(0);
    expect(result.properties.size).toBe(0);
  });

  it("handles features without properties", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: null,
        },
      ],
    };

    const result = parseGeoJson(JSON.stringify(geojson));

    expect(result.features).toHaveLength(1);
    expect(result.properties.size).toBe(0);
  });

  it("validates coordinates and aborts with error for invalid longitude", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [200, 45] },
          properties: { name: "Invalid Point" },
        },
      ],
    };

    const result = parseGeoJson(JSON.stringify(geojson));

    expect(result.features).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("invalid-projection");
  });

  it("validates coordinates and aborts with error for invalid latitude", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [45, 100] },
          properties: { name: "Invalid Point" },
        },
      ],
    };

    const result = parseGeoJson(JSON.stringify(geojson));

    expect(result.features).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("invalid-projection");
  });

  it("allows features with null geometry through", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: null,
          properties: { name: "No Geometry" },
        },
      ],
    };

    const result = parseGeoJson(JSON.stringify(geojson));

    expect(result.features).toHaveLength(1);
    expect(result.error).toBeUndefined();
    expect(result.hasValidGeometry).toBe(false);
  });

  it("allows mixed null and valid geometries", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: { name: "Valid" },
        },
        {
          type: "Feature",
          geometry: null,
          properties: { name: "Null" },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [1, 1] },
          properties: { name: "Another Valid" },
        },
      ],
    };

    const result = parseGeoJson(JSON.stringify(geojson));

    expect(result.features).toHaveLength(3);
    expect(result.error).toBeUndefined();
    expect(result.hasValidGeometry).toBe(true);
  });

  it("aborts on invalid WGS84 even with valid geometries present", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: { name: "Valid" },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [200, 0] },
          properties: { name: "Invalid" },
        },
      ],
    };

    const result = parseGeoJson(JSON.stringify(geojson));

    expect(result.features).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("invalid-projection");
  });

  it("validates GeoJSONL coordinates and aborts on error", () => {
    const geojsonl = `
{"type": "Feature", "geometry": {"type": "Point", "coordinates": [0, 0]}, "properties": {"name": "Valid"}}
{"type": "Feature", "geometry": {"type": "Point", "coordinates": [250, 0]}, "properties": {"name": "Invalid"}}
    `.trim();

    const result = parseGeoJson(geojsonl);

    expect(result.features).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("invalid-projection");
  });

  describe("coordinate transformation", () => {
    const mockProjections = new Map<string, Projection>([
      [
        "EPSG:3857",
        {
          id: "EPSG:3857",
          name: "Web Mercator",
          code: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs",
        },
      ],
    ]);

    it("works without projections parameter (backward compatibility)", () => {
      const geojson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0, 0] },
            properties: { name: "Test Point" },
          },
        ],
      };

      const result = parseGeoJson(JSON.stringify(geojson));

      expect(result.features).toHaveLength(1);
      expect(result.coordinateConversion).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it("handles no CRS without conversion", () => {
      const geojson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0, 0] },
            properties: { name: "Test Point" },
          },
        ],
      };

      const result = parseGeoJson(JSON.stringify(geojson), mockProjections);

      expect(result.features).toHaveLength(1);
      expect(result.coordinateConversion).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it("detects and converts EPSG:3857 coordinates", () => {
      const geojson = {
        type: "FeatureCollection",
        crs: {
          type: "name",
          properties: { name: "EPSG:3857" },
        },
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0, 0] },
            properties: { name: "Origin Point" },
          },
        ],
      };

      const result = parseGeoJson(JSON.stringify(geojson), mockProjections);

      expect(result.features).toHaveLength(1);
      expect(result.coordinateConversion).toBeDefined();
      expect(result.coordinateConversion?.detected).toBe("EPSG:3857");
      expect(result.coordinateConversion?.converted).toBe(true);
      expect(result.coordinateConversion?.fromCRS).toBe("Web Mercator");
      expect(result.error).toBeUndefined();
    });

    it("handles unsupported CRS with error", () => {
      const geojson = {
        type: "FeatureCollection",
        crs: {
          type: "name",
          properties: { name: "EPSG:9999" },
        },
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0, 0] },
            properties: { name: "Test Point" },
          },
        ],
      };

      const result = parseGeoJson(JSON.stringify(geojson), mockProjections);

      expect(result.features).toHaveLength(0);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("unsupported-crs");
    });
  });
});
