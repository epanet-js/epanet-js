import type { Position } from "geojson";
import type { Zone, Zones } from "./zones";
import { encodeZonesGeo, queryContainedZones, ZonesGeoView } from "./zones-geo";

const aZone = (id: number, polygons: Position[][][]): Zone => ({
  id,
  label: `Z${id}`,
  geometry: { type: "MultiPolygon", coordinates: polygons },
  bbox: [0, 0, 0, 0],
});

const square = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Position[] => [
  [minX, minY],
  [maxX, minY],
  [maxX, maxY],
  [minX, maxY],
  [minX, minY],
];

const query = (zones: Zone[], area: Position[]) => {
  const map: Zones = new Map(zones.map((zone) => [zone.id, zone]));
  const view = new ZonesGeoView(encodeZonesGeo(map));
  return queryContainedZones(view, area);
};

const closed = (points: Position[]): Position[] => [...points, points[0]];

describe("queryContainedZones", () => {
  it("returns nothing when there are no zones", () => {
    expect(query([], square(0, 0, 1, 1))).toEqual([]);
  });

  it("selects a zone the box fully encloses", () => {
    const zones = [aZone(1, [[square(2, 2, 4, 4)]])];

    expect(query(zones, square(0, 0, 10, 10))).toEqual([1]);
  });

  it("skips a zone the box only partly covers", () => {
    const zones = [aZone(1, [[square(0, 0, 10, 10)]])];

    expect(query(zones, square(8, 8, 12, 12))).toEqual([]);
  });

  it("skips a zone that contains the whole box", () => {
    const zones = [aZone(1, [[square(0, 0, 10, 10)]])];

    expect(query(zones, square(4, 4, 6, 6))).toEqual([]);
  });

  it("selects a zone a lasso fully encloses", () => {
    const zones = [aZone(1, [[square(4, 4, 6, 6)]])];
    const lasso = closed([
      [0, 0],
      [20, 0],
      [0, 20],
    ]);

    expect(query(zones, lasso)).toEqual([1]);
  });

  it("skips a zone a notch in the lasso cuts into", () => {
    const zones = [aZone(1, [[square(0, 4, 10, 6)]])];
    const lasso = closed([
      [-1, 3],
      [11, 3],
      [11, 7],
      [9, 7],
      [9, 5],
      [8, 5],
      [8, 7],
      [-1, 7],
    ]);

    expect(query(zones, lasso)).toEqual([]);
  });

  it("skips a zone whose bounds fit in a lasso but whose shape crosses it", () => {
    const zones = [aZone(1, [[square(2, 2, 8, 8)]])];
    const lasso = closed([
      [0, 0],
      [10, 0],
      [10, 10],
      [5, 5],
      [0, 10],
    ]);

    expect(query(zones, lasso)).toEqual([]);
  });

  it("requires every part of a multipolygon to be enclosed", () => {
    const zones = [
      aZone(1, [[square(0, 0, 2, 2)], [square(20, 20, 22, 22)]]),
      aZone(2, [[square(4, 4, 5, 5)], [square(6, 6, 7, 7)]]),
    ];

    expect(query(zones, square(-1, -1, 10, 10))).toEqual([2]);
  });

  it("ignores the altitude of three-dimensional positions", () => {
    const withAltitude = square(2, 2, 4, 4).map(([x, y]) => [x, y, 100]);
    const zones = [aZone(1, [[withAltitude]])];
    const lasso = closed([
      [0, 0],
      [20, 0],
      [0, 20],
    ]);

    expect(query(zones, lasso)).toEqual([1]);
  });

  it("finds a crossing in the middle of a ring with many vertices", () => {
    const circle: Position[] = [];
    for (let i = 0; i <= 200; i++) {
      const angle = (i / 200) * 2 * Math.PI;
      circle.push([Math.cos(angle) * 10, Math.sin(angle) * 10]);
    }
    const zones = [aZone(1, [[circle]])];
    const lasso = closed([
      [-20, -20],
      [20, -20],
      [20, 20],
      [0, -5],
      [-20, 20],
    ]);

    expect(query(zones, lasso)).toEqual([]);
  });

  it("returns only the zones the area encloses", () => {
    const zones = [
      aZone(1, [[square(0, 0, 10, 10)]]),
      aZone(2, [[square(20, 0, 30, 10)]]),
      aZone(3, [[square(40, 0, 50, 10)]]),
    ];

    expect(query(zones, square(-1, -1, 35, 11))).toEqual([1, 2]);
  });
});
