import type { Feature, Position } from "geojson";
import type { SourceFile } from "@epanet-js/converters";
import { zonesImporter } from "./importer";

const { scanSource, importFromSource: importSource } = zonesImporter;

const WGS84 = { type: "name", properties: { name: "EPSG:4326" } };

const aSource = (content: unknown, name = "zones.geojson"): SourceFile => ({
  name,
  arrayBuffer: () =>
    Promise.resolve(new TextEncoder().encode(JSON.stringify(content)).buffer),
});

const aFile = (features: Feature[]): SourceFile =>
  aSource({ type: "FeatureCollection", crs: WGS84, features });

const aSquare = (x = 0, y = 0, size = 0.001): Position[] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

const aZone = (
  properties: Record<string, unknown>,
  ring: Position[] = aSquare(),
): Feature => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [ring] },
  properties,
});

const filesOf = (features: Feature[]) => ({ files: [aFile(features)] });

const filesStatingNoCrs = (features: Feature[]) => ({
  files: [aSource({ type: "FeatureCollection", features })],
});

describe("zones importFromSource", () => {
  it("reads a zone per record, keyed by its position in the file", async () => {
    const { network } = await importSource(
      filesOf([aZone({}), aZone({}, aSquare(0.002, 0.002))]),
    );

    expect(network.zones!.map((zone) => zone.ref)).toEqual(["0", "1"]);
    expect(network.zones![1].polygons).toEqual([[aSquare(0.002, 0.002)]]);
  });

  it("says nothing about the rest of the model", async () => {
    const { network } = await importSource(filesOf([aZone({})]));

    expect(network.junctions).toBeUndefined();
    expect(network.customerPoints).toBeUndefined();
  });

  it("states the coordinates are WGS84 once it has placed them", async () => {
    const { network } = await importSource(filesOf([aZone({})]));

    expect(network.crs).toEqual({ type: "epsg", code: 4326 });
  });

  it("hands back records it could not place, in the coordinates it read", async () => {
    const ring = aSquare(432000, 5812000, 100);

    const { network, issues } = await importSource(
      filesStatingNoCrs([aZone({}, ring)]),
    );

    expect(network.crs).toEqual({ type: "unknown" });
    expect(network.zones![0].polygons).toEqual([[ring]]);
    expect(issues).toContainEqual({
      code: "coordinateSystemUnknown",
      severity: "error",
    });
  });

  it("leaves the label out unless one is mapped", async () => {
    const features = [aZone({ DMA: "North" })];

    const unmapped = await importSource(filesOf(features));
    expect(unmapped.network.zones![0].label).toBeUndefined();

    const mapped = await importSource({
      ...filesOf(features),
      config: { mapping: { label: "DMA" } },
    });
    expect(mapped.network.zones![0].label).toBe("North");
  });

  it("keeps a record per feature, so two sharing a label stay apart", async () => {
    const { network } = await importSource({
      ...filesOf([
        aZone({ DMA: "North" }),
        aZone({ DMA: "North" }, aSquare(0.002, 0.002)),
      ]),
      config: { mapping: { label: "DMA" } },
    });

    expect(network.zones!.map((zone) => zone.label)).toEqual([
      "North",
      "North",
    ]);
  });

  it("reads a multipolygon as one zone of several polygons", async () => {
    const island: Feature = {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: [[aSquare()], [aSquare(0.002, 0.002)]],
      },
      properties: {},
    };

    const { network, issues } = await importSource(filesOf([island]));

    expect(network.zones).toHaveLength(1);
    expect(network.zones![0].polygons).toEqual([
      [aSquare()],
      [aSquare(0.002, 0.002)],
    ]);
    expect(issues).toEqual([]);
  });

  it("keeps the holes a polygon states", async () => {
    const hole = aSquare(0.0002, 0.0002, 0.0004);
    const withHole: Feature = {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [aSquare(), hole] },
      properties: {},
    };

    const { network } = await importSource(filesOf([withHole]));

    expect(network.zones![0].polygons).toEqual([[aSquare(), hole]]);
  });

  it("closes a ring the source left open", async () => {
    const open = aSquare().slice(0, -1);

    const { network, issues } = await importSource(filesOf([aZone({}, open)]));

    expect(network.zones![0].polygons).toEqual([[aSquare()]]);
    expect(issues).toEqual([]);
  });

  it("skips a record whose geometry is not a polygon", async () => {
    const line: Feature = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [0.001, 0.001],
        ],
      },
      properties: {},
    };

    const { network, issues } = await importSource(filesOf([line, aZone({})]));

    expect(network.zones!.map((zone) => zone.ref)).toEqual(["1"]);
    expect(issues[0]).toMatchObject({
      code: "featureGeometryUnsupported",
      ref: "0",
      context: { geometry: "LineString" },
    });
  });

  it("skips a record with no geometry", async () => {
    const { network, issues } = await importSource(
      filesOf([
        { ...aZone({}), geometry: null } as unknown as Feature,
        aZone({}),
      ]),
    );

    expect(network.zones!.map((zone) => zone.ref)).toEqual(["1"]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "featureGeometryMissing",
        severity: "warning",
        ref: "0",
      }),
    );
  });

  it("skips a ring that does not enclose anything", async () => {
    const sliver = aZone({}, [
      [0, 0],
      [0.001, 0.001],
    ]);

    const { network, issues } = await importSource(
      filesOf([sliver, aZone({})]),
    );

    expect(network.zones!.map((zone) => zone.ref)).toEqual(["1"]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "zoneGeometryUnreadable",
        severity: "warning",
        ref: "0",
      }),
    );
  });

  it("skips a record whose coordinates are not numbers", async () => {
    const broken = aZone({}, [
      [0, 0],
      [Number.NaN, 0.001],
      [0.001, 0.001],
      [0, 0],
    ]);

    const { network, issues } = await importSource(
      filesOf([broken, aZone({})]),
    );

    expect(network.zones!.map((zone) => zone.ref)).toEqual(["1"]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "featureCoordinatesInvalid",
        severity: "warning",
        ref: "0",
      }),
    );
  });

  it("carries the offending record so a consumer can show it", async () => {
    const line = {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [0, 0],
          [0.001, 0.001],
        ],
      },
      properties: { DMA: "North" },
    };

    const { issues } = await importSource(filesOf([line]));

    expect(issues[0].raw).toEqual(line);
  });

  it("stops at the record limit", async () => {
    const { network } = await importSource({
      ...filesOf([aZone({}), aZone({}), aZone({})]),
      config: { recordLimit: 2 },
    });

    expect(network.zones).toHaveLength(2);
  });

  it("keeps losing the records it truly could not read", async () => {
    const { network, issues } = await importSource({ files: [] });

    expect(network.zones).toBeUndefined();
    expect(issues).toEqual([{ code: "sourceEmpty", severity: "error" }]);
  });
});

describe("zones scanSource", () => {
  it("reports the attributes, the record count and the geometry", async () => {
    const { summary } = await scanSource(
      filesOf([aZone({ DMA: "North", AREA: 12 }), aZone({ DMA: "South" })]),
    );

    expect(summary!.recordCount).toBe(2);
    expect(summary!.attributes.map(({ name }) => name)).toEqual([
      "AREA",
      "DMA",
    ]);
    expect(summary!.geometry).toBe("polygon");
  });

  it("describes a file it could not place, and says it could not", async () => {
    const { summary, issues } = await scanSource(
      filesStatingNoCrs([
        aZone({ DMA: "North" }, aSquare(432000, 5812000, 100)),
      ]),
    );

    expect(summary!.attributes.map(({ name }) => name)).toEqual(["DMA"]);
    expect(issues).toEqual([
      { code: "coordinateSystemUnknown", severity: "error" },
    ]);
  });
});
