import { describe, it, expect } from "vitest";
import { parseGeoJsonFile, GisParseError } from "./parse-geojson-file";

function makeFile(content: string, name: string): File {
  return new File([content], name, { type: "application/json" });
}

const VALID_GEOJSON = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: {},
    },
  ],
});

const EMPTY_GEOJSON = JSON.stringify({
  type: "FeatureCollection",
  features: [],
});

describe("parseGeoJsonFile", () => {
  it("returns the feature collection and name for a valid file", async () => {
    const file = makeFile(VALID_GEOJSON, "my-layer.geojson");
    const result = await parseGeoJsonFile(file, null);

    expect(result.name).toBe("my-layer");
    expect(result.featureCollection.type).toBe("FeatureCollection");
    expect(result.featureCollection.features).toHaveLength(1);
  });

  it("strips .json extension from name", async () => {
    const file = makeFile(VALID_GEOJSON, "network.json");
    const result = await parseGeoJsonFile(file, null);

    expect(result.name).toBe("network");
  });

  it("throws GisParseError with code 'no-features' for empty feature collection", async () => {
    const file = makeFile(EMPTY_GEOJSON, "empty.geojson");

    await expect(parseGeoJsonFile(file, null)).rejects.toThrow(GisParseError);
    await expect(parseGeoJsonFile(file, null)).rejects.toMatchObject({
      fileName: "empty.geojson",
      code: "no-features",
    });
  });

  it("throws GisParseError for malformed JSON", async () => {
    const file = makeFile("not valid json {{{", "bad.geojson");

    await expect(parseGeoJsonFile(file, null)).rejects.toThrow(GisParseError);
    await expect(parseGeoJsonFile(file, null)).rejects.toMatchObject({
      fileName: "bad.geojson",
    });
  });

  it("throws GisParseError with code 'invalid-format' for valid JSON that is not GeoJSON", async () => {
    const file = makeFile(JSON.stringify({ foo: "bar" }), "wrong.geojson");

    await expect(parseGeoJsonFile(file, null)).rejects.toMatchObject({
      fileName: "wrong.geojson",
      code: "invalid-format",
    });
  });

  it("GisParseError carries the original file name", async () => {
    const file = makeFile("garbage", "roads.geojson");

    try {
      await parseGeoJsonFile(file, null);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(GisParseError);
      expect((e as GisParseError).fileName).toBe("roads.geojson");
    }
  });
});
