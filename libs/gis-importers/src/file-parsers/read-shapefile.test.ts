import shp from "shpjs";
import type { Feature } from "geojson";
import type { SourceFile } from "@epanet-js/converters";
import type { Proj4Projection } from "@epanet-js/projections";
import type { GisInput } from "../importer";
import { parseGisRecords } from "./parse-gis-records";
import { parseGisSource } from "./parse-gis-source";
import { readShapefile, type ShapefileBundle } from "./read-shapefile";

type Coordinates = number[];

type Shape = {
  type: number;
  length: number;
  write: (view: DataView, at: number) => void;
};

const NULL_SHAPE = 0;
const POINT = 1;
const POLYLINE = 3;
const POLYGON = 5;
const MULTIPOINT = 8;
const POINT_Z = 11;
const POLYLINE_Z = 13;
const POLYGON_Z = 15;
const MULTIPOINT_Z = 18;

const hasZ = (type: number) => type > 10;

const zAndMLength = (points: Coordinates[]) => 2 * (16 + points.length * 8);

const writeBox = (view: DataView, at: number, points: Coordinates[]) => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  view.setFloat64(at, Math.min(...xs), true);
  view.setFloat64(at + 8, Math.min(...ys), true);
  view.setFloat64(at + 16, Math.max(...xs), true);
  view.setFloat64(at + 24, Math.max(...ys), true);
};

const writeZ = (view: DataView, at: number, points: Coordinates[]) => {
  const zs = points.map(([, , z]) => z);
  view.setFloat64(at, Math.min(...zs), true);
  view.setFloat64(at + 8, Math.max(...zs), true);
  zs.forEach((z, index) => view.setFloat64(at + 16 + index * 8, z, true));
};

const aPoint = ([x, y, z]: Coordinates): Shape => ({
  type: z === undefined ? POINT : POINT_Z,
  length: z === undefined ? 16 : 32,
  write: (view, at) => {
    view.setFloat64(at, x, true);
    view.setFloat64(at + 8, y, true);
    if (z !== undefined) view.setFloat64(at + 16, z, true);
  },
});

const aMultiPoint = (type: number, points: Coordinates[]): Shape => {
  const xyLength = 36 + points.length * 16;
  return {
    type,
    length: hasZ(type) ? xyLength + zAndMLength(points) : xyLength,
    write: (view, at) => {
      writeBox(view, at, points);
      view.setInt32(at + 32, points.length, true);
      points.forEach(([x, y], index) => {
        view.setFloat64(at + 36 + index * 16, x, true);
        view.setFloat64(at + 44 + index * 16, y, true);
      });
      if (hasZ(type)) writeZ(view, at + xyLength, points);
    },
  };
};

const aPoly = (type: number, parts: Coordinates[][]): Shape => {
  const points = parts.flat();
  const pointsAt = 44 + (parts.length - 1) * 4;
  const xyLength = pointsAt + points.length * 16;
  return {
    type,
    length: hasZ(type) ? xyLength + zAndMLength(points) : xyLength,
    write: (view, at) => {
      writeBox(view, at, points);
      view.setInt32(at + 32, parts.length, true);
      view.setInt32(at + 36, points.length, true);
      let start = 0;
      parts.forEach((part, index) => {
        view.setInt32(at + 40 + index * 4, start, true);
        start += part.length;
      });
      points.forEach(([x, y], index) => {
        view.setFloat64(at + pointsAt + index * 16, x, true);
        view.setFloat64(at + pointsAt + 8 + index * 16, y, true);
      });
      if (hasZ(type)) writeZ(view, at + xyLength, points);
    },
  };
};

const shpOf = (shapeType: number, shapes: (Shape | null)[]): ArrayBuffer => {
  const size = shapes.reduce(
    (total, shape) => total + 12 + (shape?.length ?? 0),
    100,
  );
  const view = new DataView(new ArrayBuffer(size));
  view.setInt32(0, 9994);
  view.setInt32(24, size / 2);
  view.setInt32(28, 1000, true);
  view.setInt32(32, shapeType, true);

  let at = 100;
  shapes.forEach((shape, index) => {
    view.setInt32(at, index + 1);
    view.setInt32(at + 4, (4 + (shape?.length ?? 0)) / 2);
    view.setInt32(at + 8, shape?.type ?? NULL_SHAPE, true);
    shape?.write(view, at + 12);
    at += 12 + (shape?.length ?? 0);
  });
  return view.buffer;
};

type Field = { name: string; type: string; length: number };

const dbfOf = (fields: Field[], rows: (string | number[])[][]): ArrayBuffer => {
  const headerLength = 32 + fields.length * 32 + 1;
  const recordLength = fields.reduce((total, { length }) => total + length, 1);
  const bytes = new Uint8Array(headerLength + rows.length * recordLength + 1);
  const view = new DataView(bytes.buffer);
  const encoder = new TextEncoder();

  view.setUint8(0, 3);
  view.setUint32(4, rows.length, true);
  view.setUint16(8, headerLength, true);
  view.setUint16(10, recordLength, true);
  fields.forEach(({ name, type, length }, index) => {
    const at = 32 + index * 32;
    bytes.set(encoder.encode(name), at);
    bytes[at + 11] = type.charCodeAt(0);
    bytes[at + 16] = length;
  });
  bytes[headerLength - 1] = 0x0d;

  rows.forEach((row, index) => {
    let at = headerLength + index * recordLength;
    bytes[at++] = 0x20;
    row.forEach((value, field) => {
      const { length } = fields[field];
      bytes.fill(0x20, at, at + length);
      bytes.set(typeof value === "string" ? encoder.encode(value) : value, at);
      at += length;
    });
  });
  bytes[bytes.length - 1] = 0x1a;
  return bytes.buffer;
};

const withoutBbox = (features: Feature[]): Feature[] =>
  features.map((feature) => {
    if (!feature.geometry) return feature;
    const { bbox: _bbox, ...geometry } = feature.geometry;
    return { ...feature, geometry };
  });

const calendarDateOf = (date: Date): string | null =>
  Number.isNaN(date.getTime())
    ? null
    : [
        String(date.getFullYear()).padStart(4, "0"),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

const withCalendarDates = (features: Feature[]): Feature[] =>
  features.map((feature) => ({
    ...feature,
    properties:
      feature.properties &&
      Object.fromEntries(
        Object.entries(feature.properties).map(([name, value]) => [
          name,
          value instanceof Date ? calendarDateOf(value) : value,
        ]),
      ),
  }));

const shpjsRead = async (bundle: ShapefileBundle): Promise<Feature[]> =>
  withCalendarDates(withoutBbox((await shp(bundle)).features));

const read = (bundle: ShapefileBundle): Feature[] => {
  const features: Feature[] = [];
  readShapefile(bundle, (feature) => features.push(feature));
  return features;
};

const expectAsShpjs = async (bundle: ShapefileBundle) => {
  expect(read(bundle)).toEqual(await shpjsRead(bundle));
};

const square = (
  [x, y]: Coordinates,
  size: number,
  clockwise = true,
): Coordinates[] => {
  const ring = [
    [x, y],
    [x, y + size],
    [x + size, y + size],
    [x + size, y],
    [x, y],
  ];
  return clockwise ? ring : ring.reverse();
};

describe("readShapefile", () => {
  const fields: Field[] = [
    { name: "NAME", type: "C", length: 10 },
    { name: "DIAMETER", type: "N", length: 8 },
    { name: "ACTIVE", type: "L", length: 1 },
    { name: "BUILT", type: "D", length: 8 },
  ];

  it("reads points and their attributes as shpjs does", async () => {
    await expectAsShpjs({
      shp: shpOf(POINT, [aPoint([1, 2]), null, aPoint([3, 4])]),
      dbf: dbfOf(fields, [
        ["NORTH", "100", "T", "20200115"],
        ["SOUTH", "", "F", ""],
        ["EAST", "12.5", "?", "19991231"],
      ]),
    });
  });

  it("reads points with z as shpjs does", async () => {
    await expectAsShpjs({
      shp: shpOf(POINT_Z, [aPoint([1, 2, 9]), aPoint([3, 4, 8])]),
    });
  });

  it("reads multipoints as shpjs does", async () => {
    await expectAsShpjs({
      shp: shpOf(MULTIPOINT, [
        aMultiPoint(MULTIPOINT, [[1, 1]]),
        aMultiPoint(MULTIPOINT, [
          [1, 1],
          [2, 2],
        ]),
      ]),
    });
    await expectAsShpjs({
      shp: shpOf(MULTIPOINT_Z, [
        aMultiPoint(MULTIPOINT_Z, [[1, 1, 5]]),
        aMultiPoint(MULTIPOINT_Z, [
          [1, 1, 5],
          [2, 2, 6],
        ]),
      ]),
    });
  });

  it("reads polylines of one and several parts as shpjs does", async () => {
    await expectAsShpjs({
      shp: shpOf(POLYLINE, [
        aPoly(POLYLINE, [
          [
            [0, 0],
            [1, 1],
          ],
        ]),
        aPoly(POLYLINE, [
          [
            [0, 0],
            [1, 0],
          ],
          [],
          [
            [2, 2],
            [3, 3],
            [4, 2],
          ],
        ]),
      ]),
    });
  });

  it("reads polylines with z as shpjs does", async () => {
    await expectAsShpjs({
      shp: shpOf(POLYLINE_Z, [
        aPoly(POLYLINE_Z, [
          [
            [0, 0, 1],
            [1, 1, 2],
          ],
        ]),
        aPoly(POLYLINE_Z, [
          [
            [0, 0, 1],
            [1, 0, 2],
          ],
          [
            [2, 2, 3],
            [3, 3, 4],
          ],
        ]),
      ]),
    });
  });

  it("groups polygon rings into outers and holes as shpjs does", async () => {
    await expectAsShpjs({
      shp: shpOf(POLYGON, [
        aPoly(POLYGON, [square([0, 0], 10)]),
        aPoly(POLYGON, [
          square([0, 0], 10),
          square([2, 2], 2, false),
          square([20, 20], 5),
        ]),
      ]),
    });
  });

  it("reads rings wound the other way as shpjs does", async () => {
    await expectAsShpjs({
      shp: shpOf(POLYGON, [
        aPoly(POLYGON, [square([0, 0], 10, false), square([2, 2], 2)]),
      ]),
    });
  });

  it("reads polygons with z as shpjs does", async () => {
    const withZ = (ring: Coordinates[]) => ring.map(([x, y]) => [x, y, 7]);
    await expectAsShpjs({
      shp: shpOf(POLYGON_Z, [
        aPoly(POLYGON_Z, [
          withZ(square([0, 0], 10)),
          withZ(square([2, 2], 2, false)),
        ]),
      ]),
    });
  });

  it("reads attributes in the code page the bundle states", async () => {
    const accented = [0x4e, 0xe9, 0x6f];
    await expectAsShpjs({
      shp: shpOf(POINT, [aPoint([1, 2])]),
      dbf: dbfOf([{ name: "NAME", type: "C", length: 10 }], [[accented]]),
      cpg: "1252",
    });
  });

  it("gives shapes past the end of the table no attributes", async () => {
    await expectAsShpjs({
      shp: shpOf(POINT, [aPoint([1, 2]), aPoint([3, 4])]),
      dbf: dbfOf(fields, [["NORTH", "1", "T", "20200101"]]),
    });
  });

  it("cannot read a shape type it does not know", () => {
    expect(readShapefile({ shp: shpOf(2, []) }, () => {})).toBe(false);
  });
});

const MERCATOR_PRJ =
  'PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Mercator_Auxiliary_Sphere"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",0.0],PARAMETER["Standard_Parallel_1",0.0],PARAMETER["Auxiliary_Sphere_Type",0.0],UNIT["Meter",1.0]]';

const WGS84_PRJ =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

const WEB_MERCATOR: Proj4Projection = {
  type: "proj4",
  id: "EPSG:3857",
  name: "Pseudo-Mercator",
  code: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wgs84 +no_defs",
};

const aBinaryFile = (name: string, bytes: ArrayBuffer): SourceFile => ({
  name,
  arrayBuffer: () => Promise.resolve(bytes),
});

const aTextFile = (name: string, content: string): SourceFile =>
  aBinaryFile(name, new TextEncoder().encode(content).buffer as ArrayBuffer);

const bundleOf = ({
  shapes,
  shapeType = POINT,
  prj,
}: {
  shapes: (Shape | null)[];
  shapeType?: number;
  prj?: string;
}): SourceFile[] => [
  aBinaryFile("network.shp", shpOf(shapeType, shapes)),
  aBinaryFile(
    "network.dbf",
    dbfOf(
      [{ name: "NAME", type: "C", length: 10 }],
      shapes.map((_, index) => [`N${index}`]),
    ),
  ),
  ...(prj === undefined ? [] : [aTextFile("network.prj", prj)]),
];

const expectSameParse = async (input: GisInput) => {
  const parsed = await parseGisSource(input);
  const records = await parseGisRecords(input);
  const codesOf = (issues: typeof parsed.issues) =>
    issues.build().map(({ code, ref }) => ({ code, ref }));

  expect(records.records.toFeatures()).toEqual(withoutBbox(parsed.features));
  expect(codesOf(records.issues)).toEqual(codesOf(parsed.issues));
  expect(records.sourceProjection).toEqual(parsed.sourceProjection);
  expect(records.contents.attributes).toEqual(parsed.contents.attributes);
};

describe("parseGisRecords reads a shapefile bundle as parseGisSource does", () => {
  const projections = new Map([[WEB_MERCATOR.id, WEB_MERCATOR]]);
  const inDegrees = [aPoint([0.001, 0.002]), aPoint([0.003, 0.004])];
  const inMetres = [aPoint([500000, 6000000, 12]), aPoint([500100, 6000100])];

  it("assumes WGS84 for a bundle with no .prj in degrees", async () => {
    await expectSameParse({ files: bundleOf({ shapes: inDegrees }) });
  });

  it("leaves a bundle with no .prj in metres unplaced", async () => {
    await expectSameParse({ files: bundleOf({ shapes: inMetres }) });
  });

  it("reads a bundle whose .prj says WGS84", async () => {
    await expectSameParse({
      files: bundleOf({ shapes: inDegrees, prj: WGS84_PRJ }),
      projections,
    });
  });

  it("reprojects from the .prj, keeping z", async () => {
    await expectSameParse({
      files: bundleOf({ shapes: inMetres, prj: MERCATOR_PRJ }),
      projections,
    });
  });

  it("reprojects polygons with holes from the .prj", async () => {
    await expectSameParse({
      files: bundleOf({
        shapeType: POLYGON,
        shapes: [
          aPoly(POLYGON, [
            square([500000, 6000000], 1000),
            square([500200, 6000200], 100, false),
          ]),
        ],
        prj: MERCATOR_PRJ,
      }),
      projections,
    });
  });

  it("keeps the records as written when the .prj does not place them", async () => {
    await expectSameParse({
      files: bundleOf({
        shapes: [aPoint([1e9, 1e9]), aPoint([2e9, 2e9])],
        prj: MERCATOR_PRJ,
      }),
      projections,
    });
  });

  it("keeps the records as written when the .prj cannot be applied", async () => {
    await expectSameParse({
      files: bundleOf({ shapes: inMetres, prj: "not a projection" }),
      projections,
    });
  });

  it("reads a supplied CRS in place of the .prj", async () => {
    await expectSameParse({
      files: bundleOf({ shapes: inMetres, prj: WGS84_PRJ }),
      crs: { type: "epsg", code: 3857 },
      projections,
    });
  });

  it("reports records with no coordinates and a bundle with nothing to place", async () => {
    await expectSameParse({ files: bundleOf({ shapes: [null, null] }) });
    await expectSameParse({
      files: bundleOf({
        shapeType: POLYLINE,
        shapes: [aPoly(POLYLINE, [[[0, 0]]]), null],
      }),
    });
  });

  it("reads a bundle with no .dbf", async () => {
    await expectSameParse({
      files: [aBinaryFile("network.shp", shpOf(POINT, inDegrees))],
    });
  });

  it("reports a bundle it cannot read", async () => {
    await expectSameParse({
      files: [aBinaryFile("network.shp", new ArrayBuffer(8))],
    });
  });
});
