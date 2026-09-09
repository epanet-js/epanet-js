import type { Position } from "geojson";
import type { ZoneData } from "@epanet-js/converters";
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

describe("buildZones", () => {
  it("makes one zone per record when nothing was mapped", () => {
    const { zones, mergedZones } = buildZones([
      aRecord("0"),
      aRecord("1", aSquare(2, 2)),
    ]);

    expect([...zones.keys()]).toEqual([1, 2]);
    expect([...zones.values()].map(({ label }) => label)).toEqual(["Z2", "Z3"]);
    expect(mergedZones).toEqual([]);
  });

  it("merges the records that share a label, and reports it", () => {
    const { zones, mergedZones } = buildZones([
      aRecord("0", aSquare(), "North"),
      aRecord("1", aSquare(2, 2), "North"),
      aRecord("2", aSquare(4, 4), "South"),
    ]);

    expect(zones.size).toBe(2);
    expect(zones.get(1)!.geometry.coordinates).toEqual([
      [aSquare()],
      [aSquare(2, 2)],
    ]);
    expect(mergedZones).toEqual([{ label: "North", featureCount: 2 }]);
  });

  it("generates a label for a record the mapping left blank", () => {
    const { zones } = buildZones([
      aRecord("0", aSquare(), "North"),
      aRecord("1", aSquare(2, 2)),
    ]);

    expect([...zones.values()].map(({ label }) => label)).toEqual([
      "North",
      "Z2",
    ]);
  });

  it("keeps WGS84 coordinates as they were read", () => {
    const ring = aSquare(0.001, 0.001, 0.001);

    const { zones } = buildZones([aRecord("0", ring)]);

    expect(zones.get(1)!.geometry.coordinates).toEqual([[ring]]);
  });

  it("gives every zone a bounding box", () => {
    const { zones } = buildZones([aRecord("0", aSquare(1, 1, 2))]);

    expect(zones.get(1)!.bbox).toEqual([1, 1, 3, 3]);
  });
});
