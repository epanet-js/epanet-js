import { parseGeoJson } from "./parse-geojson";

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

  it("validates coordinates and aborts with error for missing geometry", () => {
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

    expect(result.features).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("coordinates-missing");
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
});
