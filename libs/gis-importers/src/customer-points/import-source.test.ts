import type { Feature } from "geojson";
import type { SourceFile } from "@epanet-js/converters";
import { customerPointsImporter } from "./importer";

const { scanSource, importSource } = customerPointsImporter;

const WGS84 = { type: "name", properties: { name: "EPSG:4326" } };

const aSource = (content: unknown, name = "customers.geojson"): SourceFile => ({
  name,
  arrayBuffer: () =>
    Promise.resolve(new TextEncoder().encode(JSON.stringify(content)).buffer),
});

const aFile = (features: Feature[]): SourceFile =>
  aSource({ type: "FeatureCollection", crs: WGS84, features });

const aPoint = (
  properties: Record<string, unknown>,
  coordinates: number[] = [0.001, 0.001],
): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties,
});

const filesOf = (features: Feature[]) => ({ files: [aFile(features)] });

const filesStatingNoCrs = (features: Feature[]) => ({
  files: [aSource({ type: "FeatureCollection", features })],
});

describe("customer points importSource", () => {
  it("reads a point per record, keyed by its position in the file", async () => {
    const { network } = await importSource(
      filesOf([aPoint({}), aPoint({}, [0.002, 0.002])]),
    );

    expect(network.customerPoints!.map((p) => p.ref)).toEqual(["0", "1"]);
    expect(network.customerPoints![1].coordinates).toEqual([0.002, 0.002]);
  });

  it("says nothing about the rest of the model", async () => {
    const { network } = await importSource(filesOf([aPoint({})]));

    expect(network.junctions).toBeUndefined();
    expect(network.pipes).toBeUndefined();
  });

  it("leaves the label out unless one is mapped", async () => {
    const features = [aPoint({ METER: "M-1" })];

    const unmapped = await importSource(filesOf(features));
    expect(unmapped.network.customerPoints![0].label).toBeUndefined();

    const mapped = await importSource({
      ...filesOf(features),
      config: { mapping: { label: "METER" } },
    });
    expect(mapped.network.customerPoints![0].label).toBe("M-1");
  });

  it("carries the demand the source stated, unconverted", async () => {
    const { network } = await importSource({
      ...filesOf([aPoint({ USAGE: 86400 })]),
      config: {
        mapping: { demand: "USAGE" },
        units: { customerDemand: "l/d" },
      },
    });

    expect(network.customerPoints![0].demands).toEqual([{ baseDemand: 86400 }]);
    expect(network.units).toEqual({ customerDemand: "l/d" });
  });

  it("reports a record with nothing in the column the consumer mapped", async () => {
    const { network, issues } = await importSource({
      ...filesOf([aPoint({ USAGE: 10 }), aPoint({})]),
      config: { mapping: { demand: "USAGE" } },
    });

    expect(network.customerPoints).toHaveLength(2);
    expect(network.customerPoints![1].demands).toBeUndefined();
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "attributeValueUnreadable",
        severity: "warning",
        ref: "1",
        context: { attribute: "USAGE" },
      }),
    );
  });

  it("leaves demands out when no demand is mapped", async () => {
    const { network, issues } = await importSource(
      filesOf([aPoint({ USAGE: 10 }), aPoint({})]),
    );

    expect(network.customerPoints![0].demands).toBeUndefined();
    expect(issues).toEqual([]);
  });

  it("keeps the point and reports the attribute when a demand does not read", async () => {
    const { network, issues } = await importSource({
      ...filesOf([aPoint({ USAGE: "n/a" })]),
      config: { mapping: { demand: "USAGE" } },
    });

    expect(network.customerPoints).toHaveLength(1);
    expect(network.customerPoints![0].demands).toBeUndefined();
    expect(issues).toEqual([
      expect.objectContaining({
        code: "attributeValueUnreadable",
        severity: "warning",
        ref: "0",
        context: { attribute: "USAGE" },
      }),
    ]);
  });

  it("skips a record whose geometry is not a point", async () => {
    const line: Feature = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: {},
    };

    const { network, issues } = await importSource(filesOf([line, aPoint({})]));

    expect(network.customerPoints).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "featureGeometryUnsupported",
      ref: "0",
      context: { geometry: "LineString" },
    });
  });

  it("skips a record with no geometry", async () => {
    const { network, issues } = await importSource(
      filesOf([
        { ...aPoint({}), geometry: null } as unknown as Feature,
        aPoint({}),
      ]),
    );

    expect(network.customerPoints!.map((p) => p.ref)).toEqual(["1"]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "featureGeometryMissing",
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
          [1, 1],
        ],
      },
      properties: { METER: "M-9" },
    };

    const { issues } = await importSource(filesOf([line]));

    expect(issues[0].raw).toEqual(line);
  });

  it("does not let one out-of-range record condemn the whole file", async () => {
    const { network, issues } = await importSource(
      filesOf([aPoint({}), aPoint({}, [432000, 5812000]), aPoint({})]),
    );

    expect(network.customerPoints).toHaveLength(3);
    expect(issues).toEqual([]);
  });

  it("stops at the record limit", async () => {
    const { network } = await importSource({
      ...filesOf([aPoint({}), aPoint({}), aPoint({})]),
      config: { recordLimit: 2 },
    });

    expect(network.customerPoints).toHaveLength(2);
  });

  it("carries mapped custom attributes and declares them", async () => {
    const { network } = await importSource({
      ...filesOf([aPoint({ TARIFF: "domestic", ROUTE: 7 })]),
      config: { customAttributes: ["TARIFF", "ROUTE", "ABSENT"] },
    });

    expect(network.customerPoints![0].customAttributes).toEqual({
      TARIFF: "domestic",
      ROUTE: 7,
    });
    expect(network.customAttributes).toEqual([
      { ref: "TARIFF", name: "TARIFF", type: "text" },
      { ref: "ROUTE", name: "ROUTE", type: "number" },
    ]);
  });

  it("reads GeoJSONL, whose content also starts with a brace", async () => {
    const lines = [
      '{"type":"Feature","geometry":{"type":"Point","coordinates":[0.001,0.001]},"properties":{"METER":"M-1"}}',
      '{"type":"Feature","geometry":{"type":"Point","coordinates":[0.002,0.002]},"properties":{"METER":"M-2"}}',
    ].join("\n");
    const file: SourceFile = {
      name: "customers.geojsonl",
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode(lines).buffer),
    };

    const { network } = await importSource({
      files: [file],
      config: { mapping: { label: "METER" } },
    });

    expect(network.customerPoints!.map((p) => p.label)).toEqual(["M-1", "M-2"]);
  });

  it("keeps the records around a line it cannot read", async () => {
    const lines = [
      '{"type":"Feature","geometry":{"type":"Point","coordinates":[0.001,0.001]},"properties":{"METER":"M-1"}}',
      '{"type":"Feature","geometry":{"type":"Poi',
      '{"type":"Feature","geometry":{"type":"Point","coordinates":[0.002,0.002]},"properties":{"METER":"M-2"}}',
    ].join("\n");
    const file: SourceFile = {
      name: "customers.geojsonl",
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode(lines).buffer),
    };

    const { network } = await importSource({
      files: [file],
      config: { mapping: { label: "METER" } },
    });

    expect(network.customerPoints!.map((p) => p.label)).toEqual(["M-1", "M-2"]);
  });

  it("reports the issues of this mapping, not of the one before it", async () => {
    const files = [aFile([aPoint({ USAGE: "n/a", METERED: 10 })])];

    const first = await importSource({
      files,
      config: { mapping: { demand: "USAGE" } },
    });
    expect(first.issues).toHaveLength(1);

    const second = await importSource({
      files,
      config: { mapping: { demand: "METERED" } },
    });

    expect(second.issues).toEqual([]);
  });

  it("reports an unreadable file and imports nothing", async () => {
    const broken: SourceFile = {
      name: "customers.geojson",
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode("{").buffer),
    };

    const { network, issues } = await importSource({ files: [broken] });

    expect(network.customerPoints).toBeUndefined();
    expect(issues).toEqual([{ code: "sourceUnreadable", severity: "error" }]);
  });

  it("reports json that is not geojson as a format it cannot read", async () => {
    const topology: SourceFile = {
      name: "customers.geojson",
      arrayBuffer: () =>
        Promise.resolve(
          new TextEncoder().encode('{"type":"Topology","objects":{}}').buffer,
        ),
    };

    const { issues } = await importSource({ files: [topology] });

    expect(issues).toEqual([{ code: "sourceUnreadable", severity: "error" }]);
  });
});

describe("customer points scanSource", () => {
  it("reports the attributes and the record count", async () => {
    const { summary } = await scanSource(
      filesOf([aPoint({ METER: "M-1", USAGE: 10 }), aPoint({ METER: "M-2" })]),
    );

    expect(summary!.recordCount).toBe(2);
    expect(summary!.attributes.map((a) => a.name)).toEqual(["METER", "USAGE"]);
    expect(summary!.geometry).toBe("point");
  });

  it("has no summary for a source it could not read", async () => {
    const { summary, issues } = await scanSource({ files: [] });

    expect(summary).toBeNull();
    expect(issues).toEqual([{ code: "sourceEmpty", severity: "error" }]);
  });

  it("reads a file that states no CRS as WGS84, and says so", async () => {
    const { summary, issues } = await scanSource(
      filesStatingNoCrs([aPoint({})]),
    );

    expect(summary!.originalProjection).toBeUndefined();
    expect(issues).toEqual([
      { code: "coordinateSystemMissing", severity: "warning" },
    ]);
  });

  it("says nothing when the file names WGS84 itself", async () => {
    const { issues } = await scanSource(filesOf([aPoint({})]));

    expect(issues).toEqual([]);
  });

  it("does not judge the file by a record that is out of range", async () => {
    const { summary, issues } = await scanSource(
      filesOf([aPoint({}), aPoint({}, [432000, 5812000]), aPoint({})]),
    );

    expect(summary).not.toBeNull();
    expect(issues).toEqual([]);
  });

  it("refuses a file that names no CRS and is plainly not in degrees", async () => {
    const { summary, issues } = await scanSource(
      filesStatingNoCrs([
        aPoint({}, [432000, 5812000]),
        aPoint({}, [433000, 5813000]),
      ]),
    );

    expect(summary).toBeNull();
    expect(issues).toEqual([
      { code: "coordinateSystemUnknown", severity: "error" },
    ]);
  });

  it("reads that same file when the caller says what it is in", async () => {
    const osgb = new Map([
      [
        "EPSG:27700",
        {
          type: "proj4" as const,
          id: "EPSG:27700",
          name: "OSGB 1936 / British National Grid",
          code: "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +units=m +no_defs",
        },
      ],
    ]);

    const { summary, issues } = await scanSource({
      ...filesStatingNoCrs([
        aPoint({}, [432000, 181000]),
        aPoint({}, [433000, 182000]),
      ]),
      crs: { type: "epsg", code: 27700 },
      projections: osgb,
    });

    expect(summary!.originalProjection).toBe(
      "OSGB 1936 / British National Grid",
    );
    expect(issues).toEqual([]);
  });

  it("reads a file that names CRS84 without projecting it", async () => {
    const crs84 = JSON.stringify({
      type: "FeatureCollection",
      crs: {
        type: "name",
        properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
      },
      features: [aPoint({ METER: "M-1" })],
    });
    const file: SourceFile = {
      name: "customers.geojson",
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode(crs84).buffer),
    };

    const { summary, issues } = await scanSource({ files: [file] });

    expect(summary!.originalProjection).toBeUndefined();
    expect(issues).toEqual([]);
  });

  it("refuses a file whose stated WGS84 does not match its coordinates", async () => {
    const projected = JSON.stringify({
      type: "FeatureCollection",
      crs: { type: "name", properties: { name: "EPSG:4326" } },
      features: [aPoint({}, [432000, 181000]), aPoint({}, [433000, 182000])],
    });
    const file: SourceFile = {
      name: "customers.geojson",
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode(projected).buffer),
    };

    const { summary, issues } = await scanSource({ files: [file] });

    expect(summary).toBeNull();
    expect(issues).toEqual([
      { code: "coordinateSystemMismatch", severity: "error" },
    ]);
  });

  it("refuses a CRS it has no definition for", async () => {
    const { summary, issues } = await scanSource({
      ...filesStatingNoCrs([aPoint({}, [432000, 181000])]),
      crs: { type: "epsg", code: 27700 },
    });

    expect(summary).toBeNull();
    expect(issues).toEqual([
      { code: "coordinateSystemUnsupported", severity: "error" },
    ]);
  });
});
