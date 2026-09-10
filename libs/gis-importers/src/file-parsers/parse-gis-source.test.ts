import { vi } from "vitest";
import type { Feature, Position } from "geojson";
import type { SourceFile } from "@epanet-js/converters";
import type { Proj4Projection } from "@epanet-js/projections";
import { parseGisSource } from "./parse-gis-source";

vi.mock("shpjs", () => ({ default: vi.fn() }));

const shp = vi.mocked((await import("shpjs")).default);

const WEB_MERCATOR: Proj4Projection = {
  type: "proj4",
  id: "EPSG:3857",
  name: "Pseudo-Mercator",
  code: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wgs84 +no_defs",
};

const projections = new Map([[WEB_MERCATOR.id, WEB_MERCATOR]]);

const namedCrs = (name: string) => ({ type: "name", properties: { name } });

const aPoint = (coordinates: Position): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties: { NAME: "north" },
});

const IN_DEGREES: Position = [0.001, 0.001];
const IN_METRES: Position = [500000, 6000000];

const aTextFile = (content: string, name = "source.geojson"): SourceFile => ({
  name,
  arrayBuffer: () =>
    Promise.resolve(new TextEncoder().encode(content).buffer as ArrayBuffer),
});

const aJsonFile = (content: unknown, name?: string): SourceFile =>
  aTextFile(JSON.stringify(content), name);

const aCollection = (features: Feature[], crs?: string): SourceFile =>
  aJsonFile({
    type: "FeatureCollection",
    ...(crs === undefined ? {} : { crs: namedCrs(crs) }),
    features,
  });

const aBinaryFile = (name: string): SourceFile => ({
  name,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
});

const codesOf = async (input: Parameters<typeof parseGisSource>[0]) => {
  const { issues } = await parseGisSource(input);
  return issues.build().map(({ code }) => code);
};

describe("parseGisSource", () => {
  describe("GeoJSON", () => {
    it("assumes WGS84 when the file states no CRS, and says so", async () => {
      const { features, issues } = await parseGisSource({
        files: [aCollection([aPoint(IN_DEGREES)])],
      });

      expect(features).toHaveLength(1);
      expect(issues.build()).toEqual([
        { code: "coordinateSystemMissing", severity: "warning" },
      ]);
    });

    it("says nothing when the file states WGS84 itself", async () => {
      const { features, issues } = await parseGisSource({
        files: [aCollection([aPoint(IN_DEGREES)], "EPSG:4326")],
      });

      expect(features).toHaveLength(1);
      expect(issues.build()).toEqual([]);
    });

    it("reads newline-delimited features", async () => {
      const content = [
        JSON.stringify(aPoint(IN_DEGREES)),
        JSON.stringify(aPoint([0.002, 0.002])),
      ].join("\n");

      const { features } = await parseGisSource({
        files: [aTextFile(content, "source.geojsonl")],
      });

      expect(features).toHaveLength(2);
    });

    it("keeps the records when nobody could say where they are", async () => {
      const { features, issues } = await parseGisSource({
        files: [aCollection([aPoint(IN_METRES)])],
      });

      expect(features).toHaveLength(1);
      expect(features[0].geometry).toEqual({
        type: "Point",
        coordinates: IN_METRES,
      });
      expect(issues.build()).toEqual([
        { code: "coordinateSystemUnknown", severity: "error" },
      ]);
    });

    it("reprojects from the CRS the file states", async () => {
      const { features, originalProjection, issues } = await parseGisSource({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:3857")],
        projections,
      });

      const [longitude, latitude] = (
        features[0].geometry as { coordinates: Position }
      ).coordinates;

      expect(longitude).toBeCloseTo(4.4915, 3);
      expect(latitude).toBeCloseTo(47.3537, 3);
      expect(originalProjection).toEqual("Pseudo-Mercator");
      expect(issues.build()).toEqual([]);
    });

    it("refuses a CRS it has no definition for", async () => {
      const codes = await codesOf({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:27700")],
        projections,
      });

      expect(codes).toEqual(["coordinateSystemUnsupported"]);
    });

    it("returns nothing when it cannot resolve the CRS", async () => {
      const { features } = await parseGisSource({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:27700")],
        projections,
      });

      expect(features).toEqual([]);
    });

    it("refuses coordinates that contradict the CRS the file states", async () => {
      const codes = await codesOf({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:4326")],
      });

      expect(codes).toEqual(["coordinateSystemMismatch"]);
    });

    it("reads a supplied CRS where the file states none", async () => {
      const { features, issues } = await parseGisSource({
        files: [aCollection([aPoint(IN_METRES)])],
        crs: { type: "epsg", code: 3857 },
        projections,
      });

      const [longitude] = (features[0].geometry as { coordinates: Position })
        .coordinates;

      expect(longitude).toBeCloseTo(4.4915, 3);
      expect(issues.build()).toEqual([]);
    });

    it("ignores a supplied CRS of unknown type", async () => {
      const codes = await codesOf({
        files: [aCollection([aPoint(IN_METRES)])],
        crs: { type: "unknown" },
        projections,
      });

      expect(codes).toEqual(["coordinateSystemUnknown"]);
    });

    it("reports a file with no records", async () => {
      const codes = await codesOf({ files: [aCollection([])] });

      expect(codes).toEqual(["sourceEmpty"]);
    });

    it("reports a file it cannot read at all", async () => {
      const codes = await codesOf({ files: [aTextFile("not json")] });

      expect(codes).toEqual(["sourceUnreadable"]);
    });

    it("reports an empty source", async () => {
      const codes = await codesOf({ files: [] });

      expect(codes).toEqual(["sourceEmpty"]);
    });
  });

  describe("shapefile", () => {
    beforeEach(() => {
      shp.mockReset();
      shp.mockResolvedValue({
        type: "FeatureCollection",
        features: [aPoint(IN_DEGREES)],
      });
    });

    const shapefileOf = (names: string[]) => ({
      files: names.map(aBinaryFile),
    });

    it("reads a complete bundle", async () => {
      const { features, issues } = await parseGisSource(
        shapefileOf(["a.shp", "a.dbf", "a.prj"]),
      );

      expect(features).toHaveLength(1);
      expect(issues.build()).toEqual([]);
    });

    it("names what the .prj was authored in", async () => {
      const files = [
        aBinaryFile("a.shp"),
        aBinaryFile("a.dbf"),
        aTextFile(
          'PROJCS["Pseudo-Mercator",AUTHORITY["EPSG","3857"]]',
          "a.prj",
        ),
      ];

      const { originalProjection } = await parseGisSource({ files });

      expect(originalProjection).toEqual("Pseudo-Mercator");
    });

    it("names nothing when the .prj already says WGS84", async () => {
      const files = [
        aBinaryFile("a.shp"),
        aBinaryFile("a.dbf"),
        aTextFile('GEOGCS["WGS 84"]', "a.prj"),
      ];

      const { originalProjection } = await parseGisSource({ files });

      expect(originalProjection).toBeUndefined();
    });

    it("refuses a bundle with no .dbf", async () => {
      const codes = await codesOf(shapefileOf(["a.shp", "a.prj"]));

      expect(codes).toEqual(["sourceFilesIncomplete"]);
    });

    it("refuses a bundle with no .prj", async () => {
      const codes = await codesOf(shapefileOf(["a.shp", "a.dbf"]));

      expect(codes).toEqual(["sourceFilesIncomplete"]);
    });

    it("reports a bundle shpjs cannot read", async () => {
      shp.mockRejectedValue(new Error("corrupt"));

      const codes = await codesOf(shapefileOf(["a.shp", "a.dbf", "a.prj"]));

      expect(codes).toEqual(["sourceUnreadable"]);
    });

    it("reports a bundle with no records", async () => {
      shp.mockResolvedValue({ type: "FeatureCollection", features: [] });

      const codes = await codesOf(shapefileOf(["a.shp", "a.dbf", "a.prj"]));

      expect(codes).toEqual(["sourceEmpty"]);
    });
  });

  describe("decoding the same input twice", () => {
    it("reads the bytes once", async () => {
      const file = aCollection([aPoint(IN_DEGREES)]);
      const readBytes = vi.spyOn(file, "arrayBuffer");

      await parseGisSource({ files: [file] });
      await parseGisSource({ files: [file] });

      expect(readBytes).toHaveBeenCalledTimes(1);
    });

    it("reads again once the files differ", async () => {
      const file = aCollection([aPoint(IN_DEGREES)]);
      const readBytes = vi.spyOn(file, "arrayBuffer");

      await parseGisSource({ files: [file] });
      await parseGisSource({ files: [file, aBinaryFile("a.cpg")] });

      expect(readBytes).toHaveBeenCalledTimes(2);
    });

    it("reads again once the CRS to read them in differs", async () => {
      const file = aCollection([aPoint(IN_METRES)]);
      const readBytes = vi.spyOn(file, "arrayBuffer");

      await parseGisSource({ files: [file], projections });
      await parseGisSource({
        files: [file],
        crs: { type: "epsg", code: 3857 },
        projections,
      });

      expect(readBytes).toHaveBeenCalledTimes(2);
    });

    it("does not answer a placed read from an unplaced one", async () => {
      const file = aCollection([aPoint(IN_METRES)]);

      const unplaced = await parseGisSource({ files: [file], projections });
      const placed = await parseGisSource({
        files: [file],
        crs: { type: "epsg", code: 3857 },
        projections,
      });

      expect(unplaced.issues.build()).toEqual([
        { code: "coordinateSystemUnknown", severity: "error" },
      ]);
      expect(placed.issues.build()).toEqual([]);

      const [longitude] = (
        placed.features[0].geometry as { coordinates: Position }
      ).coordinates;
      expect(longitude).toBeCloseTo(4.4915, 3);
    });

    it("still answers a repeated read with the same CRS from the cache", async () => {
      const file = aCollection([aPoint(IN_METRES)]);
      const readBytes = vi.spyOn(file, "arrayBuffer");
      const crs = { type: "epsg", code: 3857 } as const;

      await parseGisSource({ files: [file], crs, projections });
      await parseGisSource({ files: [file], crs, projections });

      expect(readBytes).toHaveBeenCalledTimes(1);
    });

    it("treats a CRS of unknown type as none supplied", async () => {
      const file = aCollection([aPoint(IN_DEGREES)]);
      const readBytes = vi.spyOn(file, "arrayBuffer");

      await parseGisSource({ files: [file] });
      await parseGisSource({ files: [file], crs: { type: "unknown" } });

      expect(readBytes).toHaveBeenCalledTimes(1);
    });
  });
});
