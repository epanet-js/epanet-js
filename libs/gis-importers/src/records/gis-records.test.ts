import type { Feature, Geometry } from "geojson";
import { GisRecords } from "./gis-records";
import { RecordsBuilder } from "./records-builder";

const recordsOf = (features: Feature[]): GisRecords => {
  const builder = new RecordsBuilder();
  for (const feature of features) builder.addFeature(feature);
  return GisRecords.fromData({ bytes: builder.encode(), indices: null });
};

const feature = (
  geometry: Geometry | null,
  properties: Feature["properties"] = {},
): Feature => ({ type: "Feature", geometry: geometry as Geometry, properties });

describe("GisRecords", () => {
  it("round-trips every single-part geometry", () => {
    const features = [
      feature({ type: "Point", coordinates: [1, 2] }),
      feature({
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      }),
      feature({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 0],
          ],
          [
            [1, 1],
            [2, 1],
            [2, 2],
            [1, 1],
          ],
        ],
      }),
      feature({
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
          [
            [
              [5, 5],
              [6, 5],
              [6, 6],
              [5, 5],
            ],
          ],
        ],
      }),
    ];

    const records = recordsOf(features);

    expect(records.count).toEqual(4);
    expect(records.toFeatures()).toEqual(features);
    expect([0, 1, 2, 3].map((index) => records.kindOf(index))).toEqual([
      "point",
      "line",
      "polygon",
      "polygon",
    ]);
  });

  it("splits multi-points and multi-lines into one record per part", () => {
    const records = recordsOf([
      feature(
        {
          type: "MultiPoint",
          coordinates: [
            [1, 1],
            [2, 2],
          ],
        },
        { name: "A" },
      ),
      feature(
        {
          type: "MultiLineString",
          coordinates: [
            [
              [0, 0],
              [1, 0],
            ],
            [
              [2, 0],
              [3, 0],
            ],
          ],
        },
        { name: "B" },
      ),
    ]);

    expect(records.count).toEqual(4);
    expect(records.geometryOf(1)).toEqual({ type: "point", position: [2, 2] });
    expect(records.geometryOf(3)).toEqual({
      type: "line",
      positions: [
        [2, 0],
        [3, 0],
      ],
    });
    expect([0, 1, 2, 3].map((index) => records.valueOf(index, "name"))).toEqual(
      ["A", "A", "B", "B"],
    );
  });

  it("keeps z only on the positions that had one", () => {
    const records = recordsOf([
      feature({ type: "Point", coordinates: [1, 2, 30] }),
      feature({ type: "Point", coordinates: [3, 4] }),
    ]);

    expect(records.toGeometry(0)).toEqual({
      type: "Point",
      coordinates: [1, 2, 30],
    });
    expect(records.toGeometry(1)).toEqual({
      type: "Point",
      coordinates: [3, 4],
    });
  });

  it("keeps records without geometry and with unusable geometry", () => {
    const records = recordsOf([
      feature(null, { name: "A" }),
      feature({ type: "LineString", coordinates: [[0, 0]] }),
      feature({
        type: "GeometryCollection",
        geometries: [],
      }),
    ]);

    expect(records.count).toEqual(2);
    expect(records.kindOf(0)).toBeNull();
    expect(records.geometryOf(0)).toBeNull();
    expect(records.kindOf(1)).toEqual("unknown");
  });

  it("reads numbers, texts and mixed values", () => {
    const records = recordsOf([
      feature(null, { diameter: 100, zone: "NORTH", mixed: 1 }),
      feature(null, { diameter: 150, zone: "SOUTH", mixed: "two" }),
      feature(null, { diameter: 100, zone: "NORTH", mixed: { three: 3 } }),
    ]);

    expect(records.attributes).toEqual(["diameter", "zone", "mixed"]);
    expect(records.propertiesOf(1)).toEqual({
      diameter: 150,
      zone: "SOUTH",
      mixed: "two",
    });
    expect(records.valueOf(2, "mixed")).toEqual({ three: 3 });
    expect(records.valueOf(0, "mixed")).toEqual(1);
  });

  it("tells an attribute stated as null from one never stated", () => {
    const records = recordsOf([
      feature(null, { zone: "NORTH" }),
      feature(null, { zone: null }),
      feature(null, {}),
    ]);

    expect(records.valueOf(1, "zone")).toBeNull();
    expect(records.valueOf(2, "zone")).toBeUndefined();
    expect(records.propertiesOf(1)).toEqual({ zone: null });
    expect(records.propertiesOf(2)).toEqual({});
  });

  it("selects records over the same buffer", () => {
    const records = recordsOf(
      [10, 20, 30, 40].map((id) => feature(null, { id })),
    );

    const selected = records.select([3, 1]);
    const sliced = selected.slice(1);

    expect(selected.count).toEqual(2);
    expect(selected.valueOf(0, "id")).toEqual(40);
    expect(sliced.valueOf(0, "id")).toEqual(20);
    expect(selected.data.bytes).toBe(records.data.bytes);
  });

  it("reads back the same records from its data", () => {
    const records = recordsOf([
      feature({ type: "Point", coordinates: [1, 2] }, { id: 1 }),
      feature({ type: "Point", coordinates: [3, 4] }, { id: 2 }),
    ]).select([1]);

    const { bytes, indices } = records.data;
    const copy = GisRecords.fromData({
      bytes: bytes.slice(0),
      indices: indices && indices.slice(),
    });

    expect(copy.toFeatures()).toEqual(records.toFeatures());
  });

  it("encodes an empty source", () => {
    const records = recordsOf([]);

    expect(records.count).toEqual(0);
    expect(records.attributes).toEqual([]);
    expect(records.toFeatures()).toEqual([]);
  });
});
