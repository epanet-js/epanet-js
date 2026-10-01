import { describe, it, expect } from "vitest";
import type { Position } from "geojson";
import type { ZoneData } from "../network-data";
import { ZoneFactory } from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { buildZones } from "./build-zones";

describe("buildZones", () => {
  it("generates labels for zones the source did not name", () => {
    const { zones } = buildZones([aZone(), aZone()], aZoneFactory());

    expect(zones.get(1)!.label).toBe("Z1");
    expect(zones.get(2)!.label).toBe("Z2");
  });

  it("uses the label the source gave", () => {
    const { zones } = buildZones(
      [aZone({ label: "Zone A" }), aZone({ label: "Zone B" })],
      aZoneFactory(),
    );

    expect(zones.get(1)!.label).toBe("Zone A");
    expect(zones.get(2)!.label).toBe("Zone B");
  });

  it("generates a label only for the zones without one", () => {
    const { zones } = buildZones(
      [aZone({ label: "Zone A" }), aZone()],
      aZoneFactory(),
    );

    expect(zones.get(1)!.label).toBe("Zone A");
    expect(zones.get(2)!.label).toBe("Z1");
  });

  it("does not use the ref as a label", () => {
    const { zones } = buildZones([aZone({ ref: "7" })], aZoneFactory());

    expect(zones.get(1)!.label).toBe("Z1");
  });

  it("assigns sequential ids starting from 1", () => {
    const { zones } = buildZones([aZone(), aZone(), aZone()], aZoneFactory());

    expect([...zones.keys()]).toEqual([1, 2, 3]);
  });

  it("merges zones with the same label into a single zone", () => {
    const { zones } = buildZones(
      [
        aZone({ label: "Zone A" }),
        aZone({ label: "Zone A" }, otherSquare),
        aZone({ label: "Zone B" }),
      ],
      aZoneFactory(),
    );

    expect(zones.size).toBe(2);
    expect(zones.get(1)!.label).toBe("Zone A");
    expect(zones.get(1)!.geometry.coordinates).toEqual([
      [square],
      [otherSquare],
    ]);
    expect(zones.get(2)!.label).toBe("Zone B");
    expect(zones.get(2)!.geometry.coordinates).toHaveLength(1);
  });

  it("returns merged zone info for zones with several records", () => {
    const { mergedZones } = buildZones(
      [
        aZone({ label: "Zone A" }),
        aZone({ label: "Zone A" }, otherSquare),
        aZone({ label: "Zone B" }),
      ],
      aZoneFactory(),
    );

    expect(mergedZones).toEqual([{ label: "Zone A", featureCount: 2 }]);
  });

  it("returns empty mergedZones when no merging occurs", () => {
    const { mergedZones } = buildZones(
      [aZone({ label: "Zone A" }), aZone({ label: "Zone B" })],
      aZoneFactory(),
    );

    expect(mergedZones).toEqual([]);
  });

  it("does not merge zones without a label", () => {
    const { zones, mergedZones } = buildZones(
      [aZone(), aZone()],
      aZoneFactory(),
    );

    expect(zones.size).toBe(2);
    expect(mergedZones).toEqual([]);
  });

  it("gives every zone a bounding box", () => {
    const { zones } = buildZones([aZone({}, otherSquare)], aZoneFactory());

    expect(zones.get(1)!.bbox).toEqual([2, 2, 3, 3]);
  });

  it("draws ids from the supplied zone factory", () => {
    const { zones } = buildZones(
      [aZone(), aZone()],
      new ZoneFactory(new ConsecutiveIdsGenerator(40)),
    );

    expect([...zones.keys()]).toEqual([41, 42]);
  });
});

const square: Position[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 0],
];

const otherSquare: Position[] = [
  [2, 2],
  [3, 2],
  [3, 3],
  [2, 2],
];

const aZoneFactory = () => new ZoneFactory(new ConsecutiveIdsGenerator());

const aZone = (
  data: Partial<ZoneData> = {},
  ring: Position[] = square,
): ZoneData => ({
  ref: "1",
  polygons: [[ring]],
  ...data,
});
