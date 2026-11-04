import { describe, it, expect } from "vitest";
import { isZoneLabelAvailable, type Zone, type Zones } from "./zones";

const aZone = (id: number, label: string): Zone => ({
  id,
  label,
  geometry: { type: "MultiPolygon", coordinates: [] },
  bbox: [0, 0, 0, 0],
});

const zones: Zones = new Map([
  [1, aZone(1, "NORTH")],
  [2, aZone(2, "South")],
]);

describe("isZoneLabelAvailable", () => {
  it("accepts a label no zone uses", () => {
    expect(isZoneLabelAvailable(zones, "EAST")).toBe(true);
  });

  it("rejects a label another zone uses, ignoring case", () => {
    expect(isZoneLabelAvailable(zones, "south", 1)).toBe(false);
  });

  it("accepts the zone's own label", () => {
    expect(isZoneLabelAvailable(zones, "north", 1)).toBe(true);
  });
});
