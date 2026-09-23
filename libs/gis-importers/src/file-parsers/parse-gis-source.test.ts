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

const aFeatureWithoutGeometry = (): Feature =>
  ({
    type: "Feature",
    geometry: null,
    properties: { NAME: "nowhere" },
  }) as unknown as Feature;

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

type DxfPair = [number, string | number];

const anEntity = (type: string, pairs: DxfPair[]): DxfPair[] => [
  [0, type],
  ...pairs,
];

const aBlock = (name: string, entities: DxfPair[]): DxfPair[] => [
  [0, "BLOCK"],
  [2, name],
  [10, 0],
  [20, 0],
  ...entities,
  [0, "ENDBLK"],
];

const anInsert = ({
  block,
  layer = "0",
  x = 0,
  y = 0,
  rotation,
  scale,
}: {
  block: string;
  layer?: string;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}): DxfPair[] =>
  anEntity("INSERT", [
    [8, layer],
    [2, block],
    [10, x],
    [20, y],
    ...(scale === undefined
      ? []
      : ([
          [41, scale],
          [42, scale],
        ] as DxfPair[])),
    ...(rotation === undefined ? [] : ([[50, rotation]] as DxfPair[])),
  ]);

const anAttribute = (tag: string, value: string): DxfPair[] =>
  anEntity("ATTRIB", [
    [100, "AcDbText"],
    [1, value],
    [100, "AcDbAttribute"],
    [2, tag],
  ]);

const aLine = ({
  layer,
  from = [0, 0],
  to = [1, 1],
  paperSpace = false,
}: {
  layer: string;
  from?: Position;
  to?: Position;
  paperSpace?: boolean;
}): DxfPair[] =>
  anEntity("LINE", [
    [8, layer],
    ...(paperSpace ? ([[67, 1]] as DxfPair[]) : []),
    [10, from[0]],
    [20, from[1]],
    [11, to[0]],
    [21, to[1]],
  ]);

const aPolyline = ({
  layer,
  vertices,
  closed = false,
  bulge,
}: {
  layer: string;
  vertices: Position[];
  closed?: boolean;
  bulge?: number;
}): DxfPair[] =>
  anEntity("LWPOLYLINE", [
    [8, layer],
    [70, closed ? 1 : 0],
    ...vertices.flatMap(([x, y], index): DxfPair[] => [
      [10, x],
      [20, y],
      ...(bulge !== undefined && index === 0
        ? ([[42, bulge]] as DxfPair[])
        : []),
    ]),
  ]);

const aGeoData = ({
  definition,
  mesh,
  version = 3,
  coordinateType = 2,
}: {
  definition: string;
  mesh?: Position[];
  version?: number;
  coordinateType?: number;
}): DxfPair[] => [
  [0, "GEODATA"],
  [90, version],
  [70, coordinateType],
  ...(mesh === undefined
    ? []
    : ([
        [93, mesh.length],
        ...mesh.flatMap(([x, y]): DxfPair[] => [
          [13, x],
          [23, y],
        ]),
      ] as DxfPair[])),
  ...definition
    .match(/[\s\S]{1,250}/g)!
    .map(
      (chunk, index, chunks): DxfPair => [
        index === chunks.length - 1 ? 301 : 303,
        chunk,
      ],
    ),
];

const anEpsgAliasXml = (code: number, name = "Drawing CS") =>
  `<Dictionary><ProjectedCoordinateSystem id="${name}"><Description>${name}</Description><Alias id="${code}" type="CoordinateSystem"><Namespace>EPSG Code</Namespace></Alias></ProjectedCoordinateSystem></Dictionary>`;

const aDxf = (
  {
    header = [],
    blocks = [],
    entities = [],
    objects = [],
  }: {
    header?: DxfPair[];
    blocks?: DxfPair[];
    entities?: DxfPair[];
    objects?: DxfPair[];
  },
  name = "drawing.dxf",
): SourceFile =>
  aTextFile(
    [
      ...dxfSection("HEADER", header),
      ...dxfSection("BLOCKS", blocks),
      ...dxfSection("ENTITIES", entities),
      ...dxfSection("OBJECTS", objects),
      [0, "EOF"] as DxfPair,
    ]
      .map(([code, value]) => `${code}\n${value}`)
      .join("\n"),
    name,
  );

const dxfSection = (name: string, pairs: DxfPair[]): DxfPair[] => [
  [0, "SECTION"],
  [2, name],
  ...pairs,
  [0, "ENDSEC"],
];

const aBinaryDxf = (name = "drawing.dxf"): SourceFile => ({
  name,
  arrayBuffer: () =>
    Promise.resolve(
      new Uint8Array([
        ...[..."AutoCAD Binary DXF\r\n"].map((character) =>
          character.charCodeAt(0),
        ),
        0x1a,
        0x00,
        0x01,
        0x02,
      ]).buffer as ArrayBuffer,
    ),
});

const inCodePage1250 = (
  file: SourceFile,
  placeholder: string,
  replacement: number[],
): SourceFile => ({
  name: file.name,
  arrayBuffer: async () => {
    const content = new TextDecoder().decode(await file.arrayBuffer());
    const bytes = [...content].flatMap((character) => character.charCodeAt(0));
    const start = content.indexOf(placeholder);

    return new Uint8Array([
      ...bytes.slice(0, start),
      ...replacement,
      ...bytes.slice(start + placeholder.length),
    ]).buffer as ArrayBuffer;
  },
});

const coordinatesOf = (feature: Feature) =>
  (feature.geometry as { coordinates: unknown }).coordinates;

const expectClose = (positions: Position[], expected: Position[]) => {
  expect(positions).toHaveLength(expected.length);
  positions.forEach((position, index) => {
    expect(position[0]).toBeCloseTo(expected[index][0], 6);
    expect(position[1]).toBeCloseTo(expected[index][1], 6);
  });
};

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

    it("names no source projection when it assumed WGS84", async () => {
      const { sourceProjection } = await parseGisSource({
        files: [aCollection([aPoint(IN_DEGREES)])],
      });

      expect(sourceProjection).toBeUndefined();
    });

    it("does not take a tie for a majority in degrees", async () => {
      const codes = await codesOf({
        files: [
          aCollection([
            aPoint(IN_DEGREES),
            aFeatureWithoutGeometry(),
            aPoint(IN_METRES),
          ]),
        ],
      });

      expect(codes).toEqual(["coordinateSystemUnknown"]);
    });

    it("judges the majority over the records that have a geometry", async () => {
      const codes = await codesOf({
        files: [
          aCollection([
            aPoint(IN_DEGREES),
            aPoint(IN_DEGREES),
            aFeatureWithoutGeometry(),
            aFeatureWithoutGeometry(),
            aFeatureWithoutGeometry(),
            aPoint(IN_METRES),
          ]),
        ],
      });

      expect(codes).toEqual(["coordinateSystemMissing"]);
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
      const { features, sourceProjection, issues } = await parseGisSource({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:3857")],
        projections,
      });

      const [longitude, latitude] = (
        features[0].geometry as { coordinates: Position }
      ).coordinates;

      expect(longitude).toBeCloseTo(4.4915, 3);
      expect(latitude).toBeCloseTo(47.3537, 3);
      expect(sourceProjection?.name).toEqual("Pseudo-Mercator");
      expect(issues.build()).toEqual([]);
    });

    it("refuses a CRS it has no definition for", async () => {
      const codes = await codesOf({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:27700")],
        projections,
      });

      expect(codes).toEqual(["coordinateSystemUnsupported"]);
    });

    it("keeps the records, as written, when it cannot resolve the CRS", async () => {
      const { features } = await parseGisSource({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:27700")],
        projections,
      });

      expect(features[0].geometry).toEqual({
        type: "Point",
        coordinates: IN_METRES,
      });
    });

    it("refuses coordinates that contradict the CRS the file states", async () => {
      const codes = await codesOf({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:4326")],
      });

      expect(codes).toEqual(["coordinateSystemMismatch"]);
    });

    it("keeps the records, as written, when the stated CRS does not fit them", async () => {
      const { features } = await parseGisSource({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:4326")],
      });

      expect(features[0].geometry).toEqual({
        type: "Point",
        coordinates: IN_METRES,
      });
    });

    it("reads a supplied CRS when the stated one does not fit the records", async () => {
      const { features, sourceProjection, issues } = await parseGisSource({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:4326")],
        crs: { type: "epsg", code: 3857 },
        projections,
      });

      const [longitude] = (features[0].geometry as { coordinates: Position })
        .coordinates;

      expect(longitude).toBeCloseTo(4.4915, 3);
      expect(sourceProjection?.name).toEqual("Pseudo-Mercator");
      expect(issues.build()).toEqual([]);
    });

    it("reads a supplied CRS in place of a stated one that fits", async () => {
      const { sourceProjection, issues } = await parseGisSource({
        files: [aCollection([aPoint(IN_DEGREES)], "EPSG:4326")],
        crs: { type: "epsg", code: 3857 },
        projections,
      });

      expect(sourceProjection).toEqual(WEB_MERCATOR);
      expect(issues.build()).toEqual([]);
    });

    it("keeps the records as written when a supplied CRS does not fit, rather than falling back", async () => {
      const { features, issues } = await parseGisSource({
        files: [aCollection([aPoint(IN_DEGREES)], "EPSG:4326")],
        crs: { type: "epsg", code: 27700 },
        projections,
      });

      expect(features[0].geometry).toEqual({
        type: "Point",
        coordinates: IN_DEGREES,
      });
      expect(issues.build()).toEqual([
        { code: "coordinateSystemUnsupported", severity: "error" },
      ]);
    });

    it("reports the supplied CRS when it does not fit the records either", async () => {
      const codes = await codesOf({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:4326")],
        crs: { type: "epsg", code: 27700 },
        projections,
      });

      expect(codes).toEqual(["coordinateSystemUnsupported"]);
    });

    it("skips entries of a collection that are not features", async () => {
      const { features } = await parseGisSource({
        files: [
          aJsonFile({
            type: "FeatureCollection",
            features: [
              aPoint(IN_DEGREES),
              { type: "Point", coordinates: [0, 0] },
            ],
          }),
        ],
      });

      expect(features).toHaveLength(1);
    });

    it("names the projection it reprojected from", async () => {
      const { sourceProjection } = await parseGisSource({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:3857")],
        projections,
      });

      expect(sourceProjection).toEqual(WEB_MERCATOR);
    });

    it("names a supplied projection it reprojected from", async () => {
      const { sourceProjection } = await parseGisSource({
        files: [aCollection([aPoint(IN_METRES)], "EPSG:4326")],
        crs: { type: "epsg", code: 3857 },
        projections,
      });

      expect(sourceProjection).toEqual(WEB_MERCATOR);
    });

    it("keeps every feature around the entries that are not features", async () => {
      const notAFeature = { type: "Point", coordinates: [0, 0] };
      const { features } = await parseGisSource({
        files: [
          aJsonFile({
            type: "FeatureCollection",
            features: [
              notAFeature,
              aPoint(IN_DEGREES),
              notAFeature,
              aPoint(IN_DEGREES),
            ],
          }),
        ],
      });

      expect(features).toHaveLength(2);
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

    it("reports a file whose records have no geometry as having nothing to import", async () => {
      const { features, issues } = await parseGisSource({
        files: [aCollection([aFeatureWithoutGeometry()], "EPSG:3857")],
        projections,
      });

      expect(features).toEqual([]);
      expect(issues.build()).toEqual([
        { code: "sourceEmpty", severity: "error" },
      ]);
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

    it("skips a polyline record that holds no points, and reports it", async () => {
      const line = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [0.001, 0.001],
            [0.002, 0.002],
          ],
        },
        properties: { NAME: "north" },
      } as Feature;
      const empty = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [] },
        properties: { NAME: "nowhere" },
      } as unknown as Feature;

      shp.mockResolvedValue({
        type: "FeatureCollection",
        features: [empty, line],
      });

      const { features, issues } = await parseGisSource(
        shapefileOf(["a.shp", "a.dbf"]),
      );

      expect(features).toEqual([line]);
      expect(issues.build()).toContainEqual(
        expect.objectContaining({
          code: "featureCoordinatesInvalid",
          severity: "warning",
          ref: "0",
          raw: empty,
        }),
      );
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

      const { sourceProjection } = await parseGisSource({ files });

      expect(sourceProjection?.name).toEqual("Pseudo-Mercator");
    });

    it("names nothing when the .prj already says WGS84", async () => {
      const files = [
        aBinaryFile("a.shp"),
        aBinaryFile("a.dbf"),
        aTextFile('GEOGCS["WGS 84"]', "a.prj"),
      ];

      const { sourceProjection } = await parseGisSource({ files });

      expect(sourceProjection).toBeUndefined();
    });

    it("names nothing for a .prj that is not WKT", async () => {
      const files = [
        aBinaryFile("a.shp"),
        aTextFile("not a projection", "a.prj"),
      ];

      const { sourceProjection, issues } = await parseGisSource({
        files,
        projections,
      });

      expect(sourceProjection).toBeUndefined();
      expect(issues.build()).toEqual([]);
    });

    it("names the listed projection a .prj identifies by EPSG code", async () => {
      const files = [
        aBinaryFile("a.shp"),
        aTextFile(
          'PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",AUTHORITY["EPSG","3857"]]',
          "a.prj",
        ),
      ];

      const { sourceProjection } = await parseGisSource({
        files,
        projections,
      });

      expect(sourceProjection).toEqual(WEB_MERCATOR);
    });

    it("finds the code a .prj states before the parts that follow it", async () => {
      const files = [
        aBinaryFile("a.shp"),
        aTextFile(
          'PROJCS["Web Mercator",AUTHORITY["epsg","3857"],UNIT["Meter",1],AXIS["Easting",East]]',
          "a.prj",
        ),
      ];

      const { sourceProjection } = await parseGisSource({
        files,
        projections,
      });

      expect(sourceProjection).toEqual(WEB_MERCATOR);
    });

    it("keeps reading a nested code as the projection it belongs to, not the file's", async () => {
      const wkt =
        'PROJCS["Site grid",GEOGCS["GCS",SPHEROID["WGS84",6378137,298.257223563,AUTHORITY["EPSG","7030"]]]]';
      const files = [aBinaryFile("a.shp"), aTextFile(wkt, "a.prj")];

      const { sourceProjection } = await parseGisSource({
        files,
        projections,
      });

      expect(sourceProjection).toEqual({
        type: "proj4",
        id: "Site grid",
        name: "Site grid",
        code: wkt,
      });
    });

    it("names a .prj with no listed projection as a projection of its own", async () => {
      const wkt = 'PROJCS["ETRS_1989_UTM_Zone_30N",GEOGCS["GCS_ETRS_1989"]]';
      const files = [aBinaryFile("a.shp"), aTextFile(`${wkt}\n`, "a.prj")];

      const { sourceProjection } = await parseGisSource({
        files,
        projections,
      });

      expect(sourceProjection).toEqual({
        type: "proj4",
        id: "ETRS_1989_UTM_Zone_30N",
        name: "ETRS_1989_UTM_Zone_30N",
        code: wkt,
      });
    });

    describe("when the .prj does not place the records", () => {
      const IN_THE_WRONG_PLACE: Position = [9000000, 9000000];

      beforeEach(() => {
        shp
          .mockResolvedValueOnce({
            type: "FeatureCollection",
            features: [aPoint(IN_THE_WRONG_PLACE)],
          })
          .mockResolvedValueOnce({
            type: "FeatureCollection",
            features: [aPoint(IN_METRES)],
          });
      });

      it("keeps the records as written, and says the .prj does not fit", async () => {
        const { features, issues } = await parseGisSource(
          shapefileOf(["a.shp", "a.dbf", "a.prj"]),
        );

        expect(features[0].geometry).toEqual({
          type: "Point",
          coordinates: IN_METRES,
        });
        expect(issues.build()).toEqual([
          { code: "coordinateSystemMismatch", severity: "error" },
        ]);
      });

      it("reads the records as written by leaving the .prj out", async () => {
        await parseGisSource(shapefileOf(["a.shp", "a.dbf", "a.prj"]));

        const [input] = shp.mock.calls[1];

        expect(input).not.toHaveProperty("prj");
      });
    });

    it("reports a .prj shpjs could not apply as one it has no definition for", async () => {
      shp.mockResolvedValue({
        type: "FeatureCollection",
        features: [aPoint(IN_METRES)],
      });

      const { features, issues } = await parseGisSource(
        shapefileOf(["a.shp", "a.dbf", "a.prj"]),
      );

      expect(features).toHaveLength(1);
      expect(issues.build()).toEqual([
        { code: "coordinateSystemUnsupported", severity: "error" },
      ]);
    });

    it("reads a supplied CRS in place of the .prj", async () => {
      shp.mockResolvedValue({
        type: "FeatureCollection",
        features: [aPoint(IN_METRES)],
      });

      const { features, sourceProjection, issues } = await parseGisSource({
        ...shapefileOf(["a.shp", "a.dbf", "a.prj"]),
        crs: { type: "epsg", code: 3857 },
        projections,
      });

      const [longitude] = (features[0].geometry as { coordinates: Position })
        .coordinates;
      const [input] = shp.mock.calls[0];

      expect(longitude).toBeCloseTo(4.4915, 3);
      expect(sourceProjection).toEqual(WEB_MERCATOR);
      expect(issues.build()).toEqual([]);
      expect(input).not.toHaveProperty("prj");
    });

    describe("with no .dbf", () => {
      it("reads the bundle anyway", async () => {
        const { features, issues } = await parseGisSource(
          shapefileOf(["a.shp", "a.prj"]),
        );

        expect(features).toHaveLength(1);
        expect(issues.build()).toEqual([]);
      });

      it("asks shpjs for no attributes", async () => {
        await parseGisSource(shapefileOf(["a.shp", "a.prj"]));

        const [input] = shp.mock.calls[0];

        expect(input).not.toHaveProperty("dbf");
        expect(input).toHaveProperty("prj");
      });
    });

    describe("with no .prj", () => {
      it("assumes WGS84 when the coordinates bear it out, and says so", async () => {
        const { features, issues } = await parseGisSource(
          shapefileOf(["a.shp", "a.dbf"]),
        );

        expect(features).toHaveLength(1);
        expect(issues.build()).toEqual([
          { code: "coordinateSystemMissing", severity: "warning" },
        ]);
      });

      it("keeps the records when nobody could say where they are", async () => {
        shp.mockResolvedValue({
          type: "FeatureCollection",
          features: [aPoint(IN_METRES)],
        });

        const { features, issues } = await parseGisSource(
          shapefileOf(["a.shp", "a.dbf"]),
        );

        expect(features).toHaveLength(1);
        expect(issues.build()).toEqual([
          { code: "coordinateSystemUnknown", severity: "error" },
        ]);
      });

      it("reads a supplied CRS in its place", async () => {
        shp.mockResolvedValue({
          type: "FeatureCollection",
          features: [aPoint(IN_METRES)],
        });

        const { features, sourceProjection, issues } = await parseGisSource({
          ...shapefileOf(["a.shp", "a.dbf"]),
          crs: { type: "epsg", code: 3857 },
          projections,
        });

        const [longitude] = (features[0].geometry as { coordinates: Position })
          .coordinates;

        expect(longitude).toBeCloseTo(4.4915, 3);
        expect(sourceProjection?.name).toEqual("Pseudo-Mercator");
        expect(issues.build()).toEqual([]);
      });
    });

    it("refuses sidecars that arrive with no .shp", async () => {
      const codes = await codesOf(shapefileOf(["a.dbf", "a.prj"]));

      expect(codes).toEqual(["sourceFilesIncomplete"]);
    });

    it("reads a GeoJSON that a stray sidecar arrived alongside", async () => {
      const { features, issues } = await parseGisSource({
        files: [
          aCollection([aPoint(IN_DEGREES)], "EPSG:4326"),
          aBinaryFile("a.dbf"),
        ],
      });

      expect(features).toHaveLength(1);
      expect(issues.build()).toEqual([]);
    });

    it("reads a GeoJSON that arrives after a stray sidecar", async () => {
      const { features, issues } = await parseGisSource({
        files: [
          aBinaryFile("a.dbf"),
          aCollection([aPoint(IN_DEGREES)], "EPSG:4326"),
        ],
      });

      expect(features).toHaveLength(1);
      expect(issues.build()).toEqual([]);
    });

    it("reports a bundle shpjs cannot read", async () => {
      shp.mockRejectedValue(new Error("corrupt"));

      const codes = await codesOf(shapefileOf(["a.shp", "a.dbf", "a.prj"]));

      expect(codes).toEqual(["sourceUnreadable"]);
    });

    it("reports a bundle whose records have no geometry as having nothing to import", async () => {
      shp.mockResolvedValue({
        type: "FeatureCollection",
        features: [aFeatureWithoutGeometry()],
      });

      const codes = await codesOf(shapefileOf(["a.shp", "a.dbf"]));

      expect(codes).toEqual(["sourceEmpty"]);
    });

    it("reports a bundle with no records", async () => {
      shp.mockResolvedValue({ type: "FeatureCollection", features: [] });

      const codes = await codesOf(shapefileOf(["a.shp", "a.dbf", "a.prj"]));

      expect(codes).toEqual(["sourceEmpty"]);
    });
  });

  describe("multi-part records", () => {
    const multiOf = (
      type: "MultiPoint" | "MultiLineString",
      coordinates: unknown,
    ) =>
      ({
        type: "Feature",
        geometry: { type, coordinates },
        properties: { NAME: "north" },
      }) as unknown as Feature;

    it("reads a MultiPoint as one point per position, each with the record's attributes", async () => {
      const { features } = await parseGisSource({
        files: [
          aCollection([
            aPoint(IN_DEGREES),
            multiOf("MultiPoint", [
              [0.002, 0.002],
              [0.003, 0.003],
            ]),
          ]),
        ],
      });

      expect(
        features.map(({ geometry, properties }) => [
          geometry.type,
          (geometry as { coordinates: Position }).coordinates,
          properties,
        ]),
      ).toEqual([
        ["Point", IN_DEGREES, { NAME: "north" }],
        ["Point", [0.002, 0.002], { NAME: "north" }],
        ["Point", [0.003, 0.003], { NAME: "north" }],
      ]);
    });

    it("reads a MultiLineString as one line per part", async () => {
      const parts = [
        [
          [0.001, 0.001],
          [0.002, 0.002],
        ],
        [
          [0.003, 0.003],
          [0.004, 0.004],
        ],
      ];

      const { features } = await parseGisSource({
        files: [aCollection([multiOf("MultiLineString", parts)])],
      });

      expect(
        features.map(({ geometry }) => [
          geometry.type,
          (geometry as { coordinates: Position[] }).coordinates,
        ]),
      ).toEqual([
        ["LineString", parts[0]],
        ["LineString", parts[1]],
      ]);
    });

    it("leaves out a part with too few positions to be a line", async () => {
      const part = [
        [0.001, 0.001],
        [0.002, 0.002],
      ];

      const { features, issues } = await parseGisSource({
        files: [aCollection([multiOf("MultiLineString", [[], part])])],
      });

      expect(
        features.map(({ geometry }) => [
          geometry.type,
          (geometry as { coordinates: Position[] }).coordinates,
        ]),
      ).toEqual([["LineString", part]]);
      expect(issues.build().map(({ code }) => code)).not.toContain(
        "featureCoordinatesInvalid",
      );
    });

    it("reports a multi-part line record that yielded no line", async () => {
      const line = multiOf("MultiLineString", [
        [
          [0.001, 0.001],
          [0.002, 0.002],
        ],
      ]);
      const nothing = multiOf("MultiLineString", []);

      const { features, issues } = await parseGisSource({
        files: [aCollection([line, nothing])],
      });

      expect(features).toHaveLength(1);
      expect(issues.build()).toContainEqual(
        expect.objectContaining({
          code: "featureCoordinatesInvalid",
          severity: "warning",
          ref: "1",
          raw: nothing,
        }),
      );
    });

    it("reports a record whose coordinates are not numbers, whatever its shape", async () => {
      const notANumber = "notanumber";
      const point = {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [notANumber, notANumber] },
      } as unknown as Feature;
      const polygon = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [notANumber, 0.001],
              [0.001, 0.001],
              [0, 0],
            ],
          ],
        },
      } as unknown as Feature;

      const { features, issues } = await parseGisSource({
        files: [aCollection([point, polygon, aPoint(IN_DEGREES)])],
      });

      expect(features).toEqual([aPoint(IN_DEGREES)]);
      expect(
        issues
          .build()
          .filter(({ code }) => code === "featureCoordinatesInvalid"),
      ).toEqual([
        expect.objectContaining({ severity: "warning", ref: "0", raw: point }),
        expect.objectContaining({
          severity: "warning",
          ref: "1",
          raw: polygon,
        }),
      ]);
    });

    it("leaves a MultiPolygon whole: it is one area with several rings", async () => {
      const rings = [
        [
          [
            [0.001, 0.001],
            [0.002, 0.001],
            [0.002, 0.002],
            [0.001, 0.001],
          ],
        ],
        [
          [
            [0.003, 0.003],
            [0.004, 0.003],
            [0.004, 0.004],
            [0.003, 0.003],
          ],
        ],
      ];

      const { features } = await parseGisSource({
        files: [
          aCollection([
            {
              type: "Feature",
              geometry: { type: "MultiPolygon", coordinates: rings },
              properties: {},
            } as unknown as Feature,
          ]),
        ],
      });

      expect(features).toHaveLength(1);
      expect(features[0].geometry.type).toBe("MultiPolygon");
    });

    it("places the parts of a record it had to reproject", async () => {
      const { features } = await parseGisSource({
        files: [
          aCollection(
            [
              multiOf("MultiPoint", [
                [500000, 6000000],
                [500100, 6000100],
              ]),
            ],
            "EPSG:3857",
          ),
        ],
        projections,
      });

      expect(features).toHaveLength(2);
      for (const { geometry } of features) {
        const [longitude] = (geometry as { coordinates: Position })
          .coordinates as unknown as number[];
        expect(longitude).toBeCloseTo(4.49, 2);
      }
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
      await parseGisSource({
        files: [file, aCollection([aPoint(IN_DEGREES)])],
      });

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

  describe("DXF", () => {
    it("reads a block reference as a point carrying its layer, block and attributes", async () => {
      const { features } = await parseGisSource({
        files: [
          aDxf({
            blocks: aBlock(
              "VALVE",
              anEntity("POINT", [
                [10, 0],
                [20, 0],
              ]),
            ),
            entities: [
              ...anInsert({ block: "VALVE", layer: "valves", x: 1, y: 2 }),
              ...anAttribute("ID", "V-12"),
            ],
          }),
        ],
      });

      expect(features).toEqual([
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [1, 2] },
          properties: { ID: "V-12", Layer: "valves", BlockName: "VALVE" },
        },
      ]);
    });

    it("opens up an anonymous block, placing what it holds", async () => {
      const { features } = await parseGisSource({
        files: [
          aDxf({
            blocks: aBlock(
              "*U1",
              anEntity("LINE", [
                [8, "pipes"],
                [10, 0],
                [20, 0],
                [11, 1],
                [21, 0],
              ]),
            ),
            entities: [
              ...anInsert({
                block: "*U1",
                x: 10,
                y: 20,
                rotation: 90,
                scale: 2,
              }),
            ],
          }),
        ],
      });

      expect(features).toHaveLength(1);
      expect(features[0].properties).toEqual({ Layer: "pipes" });
      expectClose(coordinatesOf(features[0]) as Position[], [
        [10, 20],
        [10, 22],
      ]);
    });

    it("gives what a block holds on layer 0 the layer of the reference", async () => {
      const { features } = await parseGisSource({
        files: [
          aDxf({
            blocks: aBlock(
              "*U1",
              anEntity("LINE", [
                [8, "0"],
                [10, 0],
                [20, 0],
                [11, 1],
                [21, 1],
              ]),
            ),
            entities: [...anInsert({ block: "*U1", layer: "mains" })],
          }),
        ],
      });

      expect(features[0].properties).toEqual({ Layer: "mains" });
    });

    it("leaves out what is drawn on paper space", async () => {
      const { features } = await parseGisSource({
        files: [
          aDxf({
            entities: [
              ...aLine({ layer: "pipes" }),
              ...aLine({ layer: "frame", paperSpace: true }),
            ],
          }),
        ],
      });

      expect(features).toHaveLength(1);
      expect(features[0].properties).toEqual({ Layer: "pipes" });
    });

    it("reads a closed polyline as a polygon and an open one as a line", async () => {
      const { features } = await parseGisSource({
        files: [
          aDxf({
            entities: [
              ...aPolyline({
                layer: "zones",
                closed: true,
                vertices: [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                ],
              }),
              ...aPolyline({
                layer: "pipes",
                vertices: [
                  [0, 0],
                  [1, 0],
                ],
              }),
            ],
          }),
        ],
      });

      expect(features.map((feature) => feature.geometry.type)).toEqual([
        "Polygon",
        "LineString",
      ]);
      expect(coordinatesOf(features[0])).toEqual([
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ]);
    });

    it("draws a curved polyline segment as straight segments", async () => {
      const { features } = await parseGisSource({
        files: [
          aDxf({
            entities: [
              ...aPolyline({
                layer: "pipes",
                vertices: [
                  [0, 0],
                  [2, 0],
                ],
                bulge: 1,
              }),
            ],
          }),
        ],
      });

      expect((coordinatesOf(features[0]) as Position[]).length).toBeGreaterThan(
        2,
      );
    });

    it("converts a drawing in millimetres to metres", async () => {
      const { features } = await parseGisSource({
        files: [
          aDxf({
            header: [
              [9, "$INSUNITS"],
              [70, 4],
            ],
            entities: [
              ...aLine({
                layer: "pipes",
                from: [1000, 2000],
                to: [3000, 2000],
              }),
            ],
          }),
        ],
      });

      expect(coordinatesOf(features[0])).toEqual([
        [1, 2],
        [3, 2],
      ]);
    });

    it("reads names in the code page an older drawing states", async () => {
      const drawing = aDxf({
        header: [
          [9, "$ACADVER"],
          [1, "AC1015"],
          [9, "$DWGCODEPAGE"],
          [3, "ANSI_1250"],
        ],
        entities: [...aLine({ layer: "PLACEHOLDER" })],
      });

      const { features } = await parseGisSource({
        files: [inCodePage1250(drawing, "PLACEHOLDER", [0xc8, 0x65, 0x76])],
      });

      expect(features[0].properties).toEqual({ Layer: "Čev" });
    });

    it("cannot read a binary drawing", async () => {
      const codes = await codesOf({
        files: [aBinaryDxf()],
      });

      expect(codes).toEqual(["sourceUnreadable"]);
    });

    it("reads a drawing whose extension says nothing", async () => {
      const drawing = aDxf({ entities: [...aLine({ layer: "pipes" })] });

      const { features } = await parseGisSource({
        files: [{ ...drawing, name: "drawing.txt" }],
      });

      expect(features).toHaveLength(1);
    });

    it("places a drawing in the projection the caller supplies", async () => {
      const { features, issues } = await parseGisSource({
        files: [
          aDxf({
            entities: [
              ...aLine({
                layer: "pipes",
                from: [500000, 6000000],
                to: [500100, 6000000],
              }),
            ],
          }),
        ],
        crs: { type: "epsg", code: 3857 },
        projections,
      });

      expect(issues.build()).toEqual([]);
      const [longitude] = (coordinatesOf(features[0]) as Position[])[0];
      expect(longitude).toBeCloseTo(4.4915, 3);
    });

    it("places a drawing in the projection it states itself", async () => {
      const { features, issues, sourceProjection } = await parseGisSource({
        files: [
          aDxf({
            entities: aLine({
              layer: "pipes",
              from: [500000, 6000000],
              to: [500100, 6000000],
            }),
            objects: aGeoData({
              definition: anEpsgAliasXml(3857),
              mesh: [
                [0, 5000000],
                [1000000, 7000000],
              ],
            }),
          }),
        ],
        projections,
      });

      expect(issues.build()).toEqual([]);
      expect(sourceProjection?.id).toEqual("EPSG:3857");
      const [longitude] = (coordinatesOf(features[0]) as Position[])[0];
      expect(longitude).toBeCloseTo(4.4915, 3);
    });

    it("keeps a drawing its own mesh does not cover as written, so another projection can be picked", async () => {
      const { features, issues } = await parseGisSource({
        files: [
          aDxf({
            entities: aLine({
              layer: "pipes",
              from: [9000000, 9000000],
              to: [9000100, 9000000],
            }),
            objects: aGeoData({
              definition: anEpsgAliasXml(3857),
              mesh: [
                [0, 5000000],
                [1000000, 7000000],
              ],
            }),
          }),
        ],
        projections,
      });

      expect(issues.build()).toEqual([
        { code: "coordinateSystemMismatch", severity: "error" },
      ]);
      expect(coordinatesOf(features[0])).toEqual([
        [9000000, 9000000],
        [9000100, 9000000],
      ]);
    });

    it("reads a projection the drawing states as well known text", async () => {
      const { issues, sourceProjection } = await parseGisSource({
        files: [
          aDxf({
            entities: aLine({
              layer: "pipes",
              from: [500000, 6000000],
              to: [500100, 6000000],
            }),
            objects: aGeoData({
              definition:
                'PROJCS["Pseudo-Mercator",AUTHORITY["epsg","3857"],UNIT["Meter",1],AXIS["Easting",East]]',
            }),
          }),
        ],
        projections,
      });

      expect(issues.build()).toEqual([]);
      expect(sourceProjection?.id).toEqual("EPSG:3857");
    });

    it("cannot use a projection the drawing states without a code", async () => {
      const codes = await codesOf({
        files: [
          aDxf({
            entities: aLine({
              layer: "pipes",
              from: [500000, 6000000],
              to: [500100, 6000000],
            }),
            objects: aGeoData({
              definition:
                '<Dictionary><ProjectedCoordinateSystem id="Site grid"><Description>Site grid</Description></ProjectedCoordinateSystem></Dictionary>',
            }),
          }),
        ],
        projections,
      });

      expect(codes).toEqual(["coordinateSystemUnsupported"]);
    });

    it("lets a supplied projection replace the one the drawing states", async () => {
      const { issues, sourceProjection } = await parseGisSource({
        files: [
          aDxf({
            entities: aLine({
              layer: "pipes",
              from: [500000, 6000000],
              to: [500100, 6000000],
            }),
            objects: aGeoData({
              definition: anEpsgAliasXml(99999),
              mesh: [
                [0, 0],
                [1, 1],
              ],
            }),
          }),
        ],
        crs: { type: "epsg", code: 3857 },
        projections,
      });

      expect(issues.build()).toEqual([]);
      expect(sourceProjection?.id).toEqual("EPSG:3857");
    });

    it("ignores geographic data a drawing states in a version it does not know", async () => {
      const codes = await codesOf({
        files: [
          aDxf({
            entities: aLine({
              layer: "pipes",
              from: [500000, 6000000],
              to: [500100, 6000000],
            }),
            objects: aGeoData({ definition: anEpsgAliasXml(3857), version: 1 }),
          }),
        ],
        projections,
      });

      expect(codes).toEqual(["coordinateSystemUnknown"]);
    });

    it("says nobody stated a projection when the coordinates are not degrees", async () => {
      const codes = await codesOf({
        files: [
          aDxf({
            entities: [
              ...aLine({
                layer: "pipes",
                from: [500000, 6000000],
                to: [500100, 6000000],
              }),
            ],
          }),
        ],
      });

      expect(codes).toEqual(["coordinateSystemUnknown"]);
    });
  });
  describe("CSV", () => {
    const aCsv = (content: string, name = "source.csv"): SourceFile =>
      aTextFile(content, name);

    it("reads a row as a point carrying every column", async () => {
      const { features, issues } = await parseGisSource({
        files: [
          aCsv(
            [
              "Id,Longitude,Latitude,Diameter",
              "J-1,0.001,0.002,150",
              "J-2,0.003,0.004,200",
            ].join("\n"),
          ),
        ],
      });

      expect(features).toEqual([
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0.001, 0.002] },
          properties: {
            Id: "J-1",
            Longitude: "0.001",
            Latitude: "0.002",
            Diameter: "150",
          },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0.003, 0.004] },
          properties: {
            Id: "J-2",
            Longitude: "0.003",
            Latitude: "0.004",
            Diameter: "200",
          },
        },
      ]);
      expect(issues.build()).toEqual([
        { code: "coordinateSystemMissing", severity: "warning" },
      ]);
    });

    it("finds the coordinate attributes however they are written", async () => {
      for (const [x, y] of [
        ["lon", "lat"],
        ["LONGITUDE", "LATITUDE"],
        ["X", "Y"],
        ["POINT_X", "POINT_Y"],
        ["x_coord", "y_coord"],
        ["Easting", "Northing"],
      ]) {
        const { features } = await parseGisSource({
          files: [aCsv(`Id,${x},${y}\nJ-1,0.001,0.002`)],
        });

        expect(coordinatesOf(features[0])).toEqual([0.001, 0.002]);
      }
    });

    it("prefers longitude and latitude over projected attributes", async () => {
      const { features } = await parseGisSource({
        files: [aCsv("Easting,Northing,Lon,Lat\n500000,6000000,0.001,0.002")],
      });

      expect(coordinatesOf(features[0])).toEqual([0.001, 0.002]);
    });

    it("keeps the records unplaced when no attribute names a coordinate", async () => {
      const { features, issues, contents } = await parseGisSource({
        files: [aCsv("Id,First,Second\nJ-1,0.001,0.002")],
      });

      expect(issues.build()).toEqual([
        { code: "coordinateAttributesUnknown", severity: "error" },
      ]);
      expect(features[0].geometry).toBeNull();
      expect(contents.recordCount).toEqual(1);
      expect(contents.attributes.map(({ name }) => name)).toEqual([
        "First",
        "Id",
        "Second",
      ]);
      expect(contents.groups).toEqual([]);
    });

    it("reads the attributes the caller named instead of looking for them", async () => {
      const { features } = await parseGisSource({
        files: [aCsv("Id,First,Second\nJ-1,0.001,0.002")],
        coordinateAttributes: { x: "First", y: "Second" },
      });

      expect(coordinatesOf(features[0])).toEqual([0.001, 0.002]);
    });

    it("takes the caller's attributes over the ones it would have found", async () => {
      const { features } = await parseGisSource({
        files: [aCsv("Lon,Lat,East,North\n0.001,0.002,0.003,0.004")],
        coordinateAttributes: { x: "East", y: "North" },
      });

      expect(coordinatesOf(features[0])).toEqual([0.003, 0.004]);
    });

    it("keeps the records unplaced when the caller names an attribute the file has not", async () => {
      const codes = await codesOf({
        files: [aCsv("Lon,Lat\n0.001,0.002")],
        coordinateAttributes: { x: "East", y: "North" },
      });

      expect(codes).toEqual(["coordinateAttributesUnknown"]);
    });

    it("leaves out the records it cannot read, reporting each one", async () => {
      const { features, contents, issues } = await parseGisSource({
        files: [
          aCsv(
            [
              "Id,Lon,Lat",
              "J-1,0.001,0.002",
              "J-2,,0.004",
              "J-3,not a number,0.006",
            ].join("\n"),
          ),
        ],
      });

      expect(features).toHaveLength(1);
      expect(coordinatesOf(features[0])).toEqual([0.001, 0.002]);
      expect(contents.recordCount).toEqual(1);
      expect(issues.build()).toEqual([
        { code: "coordinateSystemMissing", severity: "warning" },
        {
          code: "featureCoordinatesInvalid",
          severity: "warning",
          ref: "1",
          raw: { Id: "J-2", Lon: "", Lat: "0.004" },
        },
        {
          code: "featureCoordinatesInvalid",
          severity: "warning",
          ref: "2",
          raw: { Id: "J-3", Lon: "not a number", Lat: "0.006" },
        },
      ]);
    });

    it("asks for the attributes when no record could be read from the ones it found", async () => {
      const { features, contents, issues } = await parseGisSource({
        files: [aCsv("Id,X,Y\nJ-1,north,west\nJ-2,south,east")],
      });

      expect(issues.build()).toEqual([
        { code: "coordinateAttributesUnknown", severity: "error" },
      ]);
      expect(features).toHaveLength(2);
      expect(contents.recordCount).toEqual(2);
      expect(contents.attributes.map(({ name }) => name)).toEqual([
        "Id",
        "X",
        "Y",
      ]);
    });

    it("reads a semicolon separated file written with decimal commas", async () => {
      const { features } = await parseGisSource({
        files: [aCsv("Id;Lon;Lat\nJ-1;0,001;0,002")],
      });

      expect(coordinatesOf(features[0])).toEqual([0.001, 0.002]);
    });

    it("reads a tab separated file", async () => {
      const { features } = await parseGisSource({
        files: [aCsv("Id\tLon\tLat\nJ-1\t0.001\t0.002", "source.tsv")],
      });

      expect(coordinatesOf(features[0])).toEqual([0.001, 0.002]);
    });

    it("says nobody stated a projection when the coordinates are not degrees", async () => {
      const codes = await codesOf({
        files: [aCsv("Id,Easting,Northing\nJ-1,500000,6000000")],
      });

      expect(codes).toEqual(["coordinateSystemUnknown"]);
    });

    it("places projected coordinates with the CRS the caller supplies", async () => {
      const { features, issues } = await parseGisSource({
        files: [aCsv("Id,Easting,Northing\nJ-1,500000,6000000")],
        crs: { type: "epsg", code: 3857 },
        projections,
      });

      expect(issues.build()).toEqual([]);
      const [longitude] = coordinatesOf(features[0]) as Position;
      expect(longitude).toBeCloseTo(4.4915, 3);
    });

    it("is empty when the file holds nothing but a header", async () => {
      const codes = await codesOf({ files: [aCsv("Id,Lon,Lat\n")] });

      expect(codes).toEqual(["sourceEmpty"]);
    });

    it("is unreadable when the file has no header at all", async () => {
      const codes = await codesOf({ files: [aCsv("")] });

      expect(codes).toEqual(["sourceUnreadable"]);
    });

    it("reads again once the attributes to read them from differ", async () => {
      const file = aCsv("Id,First,Second\nJ-1,0.001,0.002");
      const readBytes = vi.spyOn(file, "arrayBuffer");

      await parseGisSource({ files: [file] });
      await parseGisSource({
        files: [file],
        coordinateAttributes: { x: "First", y: "Second" },
      });

      expect(readBytes).toHaveBeenCalledTimes(2);
    });
  });
});
