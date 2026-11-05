import type { Position } from "geojson";
import { Zone, type Zones } from "./zones";
import {
  encodeZonesGeo,
  queryIntersectingZones,
  ZonesGeoView,
} from "./zones-geo";

const aZone = (id: number, polygons: Position[][][]): Zone =>
  new Zone(id, { type: "MultiPolygon", coordinates: polygons }, [0, 0, 0, 0], {
    label: `Z${id}`,
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
  return queryIntersectingZones(view, area);
};

const triangle = (points: Position[]): Position[] => [...points, points[0]];

describe("queryIntersectingZones", () => {
  it("returns nothing when there are no zones", () => {
    expect(query([], square(0, 0, 1, 1))).toEqual([]);
  });

  it("selects a zone a box partly overlaps", () => {
    const zones = [aZone(1, [[square(0, 0, 10, 10)]])];

    expect(query(zones, square(8, 8, 12, 12))).toEqual([1]);
  });

  it("selects a zone that fully contains the box", () => {
    const zones = [aZone(1, [[square(0, 0, 10, 10)]])];

    expect(query(zones, square(4, 4, 6, 6))).toEqual([1]);
  });

  it("selects a zone that a lasso fully contains", () => {
    const zones = [aZone(1, [[square(4, 4, 6, 6)]])];
    const lasso = triangle([
      [0, 0],
      [20, 0],
      [0, 20],
    ]);

    expect(query(zones, lasso)).toEqual([1]);
  });

  it("selects a zone a lasso crosses with no corner inside the other", () => {
    const zones = [aZone(1, [[square(0, 4, 10, 6)]])];
    const lasso = triangle([
      [4, -10],
      [6, -10],
      [5, 20],
    ]);

    expect(query(zones, lasso)).toEqual([1]);
  });

  it("selects a zone the box only touches", () => {
    const zones = [aZone(1, [[square(0, 0, 10, 10)]])];

    expect(query(zones, square(10, 2, 12, 4))).toEqual([1]);
  });

  it("skips a zone whose bounds overlap the area but whose shape does not", () => {
    const lShape: Position[] = [
      [0, 0],
      [10, 0],
      [10, 2],
      [2, 2],
      [2, 10],
      [0, 10],
      [0, 0],
    ];
    const zones = [aZone(1, [[lShape]])];

    expect(query(zones, square(5, 5, 8, 8))).toEqual([]);
  });

  it("skips a zone when the lasso sits inside one of its holes", () => {
    const zones = [aZone(1, [[square(0, 0, 10, 10), square(3, 3, 7, 7)]])];
    const lasso = triangle([
      [4, 4],
      [6, 4],
      [5, 6],
    ]);

    expect(query(zones, lasso)).toEqual([]);
  });

  it("selects a zone through any part of a multipolygon", () => {
    const zones = [aZone(1, [[square(0, 0, 2, 2)], [square(20, 20, 22, 22)]])];

    expect(query(zones, square(19, 19, 21, 21))).toEqual([1]);
  });

  it("ignores the altitude of three-dimensional positions", () => {
    const withAltitude = square(0, 0, 10, 10).map(([x, y]) => [x, y, 100]);
    const zones = [aZone(1, [[withAltitude]])];

    expect(query(zones, square(8, 8, 12, 12))).toEqual([1]);
  });

  it("finds a crossing in the middle of a ring with many vertices", () => {
    const circle: Position[] = [];
    for (let i = 0; i <= 200; i++) {
      const angle = (i / 200) * 2 * Math.PI;
      circle.push([Math.cos(angle) * 10, Math.sin(angle) * 10]);
    }
    const zones = [aZone(1, [[circle]]), aZone(2, [[square(30, 30, 31, 31)]])];
    const lasso = triangle([
      [-1, -20],
      [1, -20],
      [0, -9],
    ]);

    expect(query(zones, lasso)).toEqual([1]);
  });

  it("returns only the zones the area reaches", () => {
    const zones = [
      aZone(1, [[square(0, 0, 10, 10)]]),
      aZone(2, [[square(20, 0, 30, 10)]]),
      aZone(3, [[square(40, 0, 50, 10)]]),
    ];

    expect(query(zones, square(5, 5, 25, 6))).toEqual([1, 2]);
  });
});

const viewOf = (zone: Zone) => {
  const view = new ZonesGeoView(encodeZonesGeo(new Map([[zone.id, zone]])));
  return { view, index: view.zoneIndexOf(zone.id)! };
};

describe("ZonesGeoView.containsPoint", () => {
  const withHole = aZone(1, [
    [square(0, 0, 10, 10), square(4, 4, 6, 6)],
    [square(20, 0, 30, 10)],
  ]);

  it.each([
    { label: "inside", point: [2, 2], expected: true },
    { label: "outside", point: [15, 5], expected: false },
    { label: "in a hole", point: [5, 5], expected: false },
    { label: "on the outer border", point: [0, 5], expected: true },
    { label: "on a hole's border", point: [4, 5], expected: true },
    { label: "in a second part", point: [25, 5], expected: true },
  ])("is $expected for a point $label", ({ point, expected }) => {
    const { view, index } = viewOf(withHole);

    expect(view.containsPoint(index, point[0], point[1])).toBe(expected);
  });
});

describe("ZonesGeoView.zonesAt", () => {
  const zonesView = (zones: Zone[]) =>
    new ZonesGeoView(
      encodeZonesGeo(new Map(zones.map((zone) => [zone.id, zone]))),
    );

  it("returns the zones that contain the point", () => {
    const view = zonesView([
      aZone(1, [[square(0, 0, 10, 10)]]),
      aZone(2, [[square(5, 0, 15, 10)]]),
      aZone(3, [[square(20, 0, 30, 10)]]),
    ]);

    expect(view.zonesAt(7, 5).sort()).toEqual([1, 2]);
    expect(view.zonesAt(25, 5)).toEqual([3]);
  });

  it("returns nothing for a point in a hole or outside every zone", () => {
    const view = zonesView([
      aZone(1, [[square(0, 0, 10, 10), square(4, 4, 6, 6)]]),
    ]);

    expect(view.zonesAt(5, 5)).toEqual([]);
    expect(view.zonesAt(15, 5)).toEqual([]);
  });

  it("returns nothing when there are no zones", () => {
    expect(zonesView([]).zonesAt(0, 0)).toEqual([]);
  });
});

describe("ZonesGeoView.classifyLine", () => {
  const twoParts = aZone(1, [
    [square(0, 0, 10, 10), square(4, 4, 6, 6)],
    [square(20, 0, 30, 10)],
  ]);

  it.each([
    {
      label: "inside for a line within one part",
      line: [
        [1, 1],
        [3, 2],
        [2, 8],
      ],
      expected: "inside",
    },
    {
      label: "inside for a line that touches the border",
      line: [
        [0, 2],
        [3, 2],
      ],
      expected: "inside",
    },
    {
      label: "boundary for a line leaving the zone",
      line: [
        [2, 2],
        [15, 2],
      ],
      expected: "boundary",
    },
    {
      label: "boundary for a line from the border to outside",
      line: [
        [0, 2],
        [-5, 2],
      ],
      expected: "boundary",
    },
    {
      label: "null for a line that crosses with both ends outside",
      line: [
        [-5, 2],
        [15, 2],
      ],
      expected: null,
    },
    {
      label: "null for a line with only a middle vertex inside",
      line: [
        [-2, 2],
        [2, 2],
        [-2, 3],
      ],
      expected: null,
    },
    {
      label: "null for a line through a hole with both ends inside",
      line: [
        [2, 5],
        [8, 5],
      ],
      expected: null,
    },
    {
      label: "null for a line spanning two parts",
      line: [
        [8, 2],
        [22, 2],
      ],
      expected: null,
    },
    {
      label: "null for a line inside a hole",
      line: [
        [4.5, 4.5],
        [5.5, 5.5],
      ],
      expected: null,
    },
    {
      label: "null for a line outside",
      line: [
        [12, 2],
        [18, 2],
      ],
      expected: null,
    },
  ])("is $label", ({ line, expected }) => {
    const { view, index } = viewOf(twoParts);

    expect(view.classifyLine(index, line)).toBe(expected);
  });

  it("ignores the altitude of three-dimensional zone positions", () => {
    const withAltitude = square(0, 0, 10, 10).map(([x, y]) => [x, y, 100]);
    const { view, index } = viewOf(aZone(1, [[withAltitude]]));

    expect(
      view.classifyLine(index, [
        [2, 2],
        [3, 3],
      ]),
    ).toBe("inside");
  });

  it("finds a crossing in the middle of a ring with many vertices", () => {
    const circle: Position[] = [];
    for (let i = 0; i <= 200; i++) {
      const angle = (i / 200) * 2 * Math.PI;
      circle.push([Math.cos(angle) * 10, Math.sin(angle) * 10]);
    }
    const { view, index } = viewOf(aZone(1, [[circle]]));

    expect(
      view.classifyLine(index, [
        [0, -5],
        [0, -15],
      ]),
    ).toBe("boundary");
  });
});
