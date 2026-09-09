import type { Position } from "geojson";
import type { ZoneData } from "@epanet-js/converters";
import { createProjectionMapper } from "@epanet-js/projections";
import type { Placement } from "src/hooks/use-placement";
import { buildZones } from "./build-zones";

const aSquare = (x = 0, y = 0, size = 1): Position[] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

const aRecord = (
  ref: string,
  ring: Position[] = aSquare(),
  label?: string,
): ZoneData => ({
  ref,
  polygons: [[ring]],
  ...(label === undefined ? {} : { label }),
});

const wgs84: Placement = { kind: "wgs84" };

const gridAt = (centroid: [number, number]): Placement => ({
  kind: "transform",
  toWgs84: createProjectionMapper({
    type: "xy-grid",
    id: "xy-grid",
    name: "XY Grid",
    centroid,
  }).toWgs84,
});

describe("buildZones", () => {
  it("makes one zone per record when nothing was mapped", () => {
    const { zones, mergedZones } = buildZones(
      [aRecord("0"), aRecord("1", aSquare(2, 2))],
      wgs84,
    );

    expect([...zones.keys()]).toEqual([1, 2]);
    expect([...zones.values()].map(({ label }) => label)).toEqual(["Z2", "Z3"]);
    expect(mergedZones).toEqual([]);
  });

  it("merges the records that share a label, and reports it", () => {
    const { zones, mergedZones } = buildZones(
      [
        aRecord("0", aSquare(), "North"),
        aRecord("1", aSquare(2, 2), "North"),
        aRecord("2", aSquare(4, 4), "South"),
      ],
      wgs84,
    );

    expect(zones.size).toBe(2);
    expect(zones.get(1)!.geometry.coordinates).toEqual([
      [aSquare()],
      [aSquare(2, 2)],
    ]);
    expect(mergedZones).toEqual([{ label: "North", featureCount: 2 }]);
  });

  it("generates a label for a record the mapping left blank", () => {
    const { zones } = buildZones(
      [aRecord("0", aSquare(), "North"), aRecord("1", aSquare(2, 2))],
      wgs84,
    );

    expect([...zones.values()].map(({ label }) => label)).toEqual([
      "North",
      "Z2",
    ]);
  });

  it("keeps WGS84 coordinates as they were read", () => {
    const ring = aSquare(0.001, 0.001, 0.001);

    const { zones } = buildZones([aRecord("0", ring)], wgs84);

    expect(zones.get(1)!.geometry.coordinates).toEqual([[ring]]);
  });

  it("places local coordinates with the project's own transform", () => {
    const centroid: [number, number] = [1000, 2000];

    const { zones } = buildZones(
      [aRecord("0", aSquare(1000, 2000, 100))],
      gridAt(centroid),
    );

    const ring = zones.get(1)!.geometry.coordinates[0][0];
    for (const [longitude, latitude] of ring) {
      expect(Math.abs(longitude)).toBeLessThanOrEqual(180);
      expect(Math.abs(latitude)).toBeLessThanOrEqual(90);
    }
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("places two files of different extents in the same space", () => {
    const placement = gridAt([1000, 2000]);
    const shared = aSquare(1200, 2200, 10);

    const alone = buildZones([aRecord("0", shared)], placement);
    const alongside = buildZones(
      [aRecord("0", aSquare(5000, 9000, 10)), aRecord("1", shared)],
      placement,
    );

    expect(alongside.zones.get(2)!.geometry.coordinates).toEqual(
      alone.zones.get(1)!.geometry.coordinates,
    );
  });

  it("gives every zone a bounding box", () => {
    const { zones } = buildZones([aRecord("0", aSquare(1, 1, 2))], wgs84);

    expect(zones.get(1)!.bbox).toEqual([1, 1, 3, 3]);
  });
});
