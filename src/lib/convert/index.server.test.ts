import { expect, describe, it } from "vitest";

import { DEFAULT_IMPORT_OPTIONS } from ".";
import { GeoJSON } from "./geojson";
import { twoPoints, fcLineString } from "test/helpers";
import { CSV } from "./csv";
import { Shapefile } from "./shapefile";
import { Blob } from "buffer";
import { getExtension } from "./utils";
import { CoordinateString } from "./coordinate_string";

describe("convert", () => {
  describe("Shapefile", () => {
    it("back", async () => {
      const res = (
        await Shapefile.back(
          { geojson: fcLineString },
          {
            type: Shapefile.id,
            folderId: null,
          },
        )
      ).unsafeCoerce();
      expect(res).toHaveProperty("name", "shapefile.zip");
    });
    // TODO: extremely difficult to test this portion because
    // of Buffer/ArrayBuffer confusion and jsdom
    // it("forward", async () => {
    //   const res = (
    //     await Shapefile.back(fcLineString, {
    //       type: Shapefile.id,
    //     })
    //   ).unsafeCoerce();
    //   const loop = (
    //     await Shapefile.forwardBinary(
    //       {
    //         arrayBuffer() {
    //           return readAsBuffer(res.blob);
    //         },
    //       } as any,
    //       {
    //         ...DEFAULT_IMPORT_OPTIONS,
    //         type: Shapefile.id,
    //       }
    //     )
    //   ).unsafeCoerce();
    //   console.log(loop);
    // });
  });
  describe("CoordinateString", () => {
    it("forwardString", async () => {
      expect(
        (
          await CoordinateString.forwardString("1, 2", {
            ...DEFAULT_IMPORT_OPTIONS,
            coordinateStringOptions: {
              order: "LONLAT",
            },
            type: "coordinate-string",
          })
        ).unsafeCoerce(),
      ).toHaveProperty("geojson", {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Point",
              coordinates: [1, 2],
            },
          },
        ],
      });
    });
    it("featureToString", async () => {
      await expect(
        CoordinateString.featureToString({
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [1, 2],
          },
        }),
      ).resolves.toEqualRight("1,2");

      await expect(
        CoordinateString.featureToString({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [1, 2],
              [3, 4],
            ],
          },
        }),
      ).resolves.toBeLeft();
    });
  });
  // TODO: this is blocked by dynamic import() support
  // in the test stack.

  it("getExtension", () => {
    expect(getExtension("foo.bar")).toEqual(".bar");
    expect(getExtension("foo")).toEqual("");
    expect(getExtension("foo.bar.baz")).toEqual(".baz");
  });
  (global as any).Blob = Blob;

  describe("CSV", () => {
    it("can translate lines", async () => {
      expect(
        (
          await CSV.back(
            { geojson: twoPoints },
            {
              type: "csv",
              folderId: null,
            },
          )
        ).unsafeCoerce(),
      ).toHaveProperty("name", "features.csv");
    });
  });

  describe("GeoJSON", () => {
    const OPTIONS = {
      ...DEFAULT_IMPORT_OPTIONS,
      type: GeoJSON.id,
    } as const;

    it("forward", async () => {
      const point = { type: "Point", coordinates: [0, 0] };
      const pointFeature = {
        type: "Feature",
        properties: { x: 1 },
        geometry: { type: "Point", coordinates: [0, 0] },
      };

      expect(
        (
          await GeoJSON.forwardString(JSON.stringify(point), OPTIONS)
        ).unsafeCoerce(),
      ).toHaveProperty("geojson", {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: point,
          },
        ],
      });

      const featureOut = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { x: 1 },
            geometry: point,
          },
        ],
      };
      expect(
        (
          await GeoJSON.forwardString(JSON.stringify(pointFeature), OPTIONS)
        ).unsafeCoerce(),
      ).toHaveProperty("geojson", featureOut);
      expect(
        (
          await GeoJSON.forwardString(JSON.stringify(featureOut), OPTIONS)
        ).unsafeCoerce(),
      ).toHaveProperty("geojson", featureOut);
    });
    it("back", async () => {
      expect(
        (
          await GeoJSON.back(
            {
              featureMapDeprecated: new Map(),
            },
            {
              type: "geojson",
              folderId: null,
              geojsonOptions: {
                winding: "RFC7946",
                truncate: false,
                addBboxes: true,
                includeId: false,
                indent: true,
              },
            },
          )
        ).unsafeCoerce(),
      ).toHaveProperty("name", "features.geojson");
    });
  });
});
