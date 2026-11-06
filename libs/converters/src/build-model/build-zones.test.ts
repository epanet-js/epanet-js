import { describe, it, expect } from "vitest";
import type { Position } from "geojson";
import type { ZoneData } from "../network-data";
import { ZoneFactory } from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { buildZones, type ZoneAttributePlan } from "./build-zones";

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

  it("merges zones with the same label and agreeing attributes", () => {
    const { zones, mergedZones } = buildZones(
      [
        aZone({ label: "NORTH", customAttributes: { AREA: "LOW" } }),
        aZone(
          { label: "NORTH", customAttributes: { AREA: "LOW", POP: 7 } },
          otherSquare,
        ),
      ],
      aZoneFactory(),
      plan,
    );

    expect(zones.size).toBe(1);
    expect(zones.get(1)!.getProperty("custom-1")).toBe("LOW");
    expect(zones.get(1)!.getProperty("custom-2")).toBe(7);
    expect(mergedZones).toEqual([{ label: "NORTH", featureCount: 2 }]);
  });

  it("lets an empty value merge with any value", () => {
    const { zones } = buildZones(
      [
        aZone({ label: "NORTH" }),
        aZone({ label: "NORTH", customAttributes: { AREA: "LOW" } }),
        aZone({ label: "NORTH", customAttributes: { POP: 7 } }),
      ],
      aZoneFactory(),
      plan,
    );

    expect(zones.size).toBe(1);
    expect(zones.get(1)!.getProperty("custom-1")).toBe("LOW");
    expect(zones.get(1)!.getProperty("custom-2")).toBe(7);
  });

  it("gives a zone with conflicting attributes a suffixed label", () => {
    const { zones, renamedZones } = buildZones(
      [
        aZone({ label: "NORTH", customAttributes: { AREA: "LOW" } }),
        aZone({ label: "NORTH", customAttributes: { AREA: "HIGH" } }),
      ],
      aZoneFactory(),
      plan,
    );

    expect([...zones.values()].map((zone) => zone.label)).toEqual([
      "NORTH",
      "NORTH_1",
    ]);
    expect(zones.get(2)!.getProperty("custom-1")).toBe("HIGH");
    expect(renamedZones).toEqual([
      { label: "NORTH_1", originalLabel: "NORTH" },
    ]);
  });

  it("joins the first zone of that label it does not conflict with", () => {
    const { zones, mergedZones } = buildZones(
      [
        aZone({ label: "NORTH", customAttributes: { AREA: "LOW" } }),
        aZone({ label: "NORTH", customAttributes: { AREA: "HIGH" } }),
        aZone({ label: "NORTH", customAttributes: { AREA: "HIGH" } }),
      ],
      aZoneFactory(),
      plan,
    );

    expect(zones.size).toBe(2);
    expect(mergedZones).toEqual([{ label: "NORTH_1", featureCount: 2 }]);
  });

  it("skips a suffix the source already uses as a label", () => {
    const { zones } = buildZones(
      [
        aZone({ label: "NORTH", customAttributes: { AREA: "LOW" } }),
        aZone({ label: "NORTH_1" }),
        aZone({ label: "NORTH", customAttributes: { AREA: "HIGH" } }),
      ],
      aZoneFactory(),
      plan,
    );

    expect([...zones.values()].map((zone) => zone.label)).toEqual([
      "NORTH",
      "NORTH_1",
      "NORTH_2",
    ]);
  });

  it("merges zones whose labels differ only in case, keeping the first spelling", () => {
    const { zones, mergedZones, renamedZones } = buildZones(
      [aZone({ label: "North" }), aZone({ label: "NORTH" }, otherSquare)],
      aZoneFactory(),
      plan,
    );

    expect([...zones.values()].map((zone) => zone.label)).toEqual(["North"]);
    expect(mergedZones).toEqual([{ label: "North", featureCount: 2 }]);
    expect(renamedZones).toEqual([]);
  });

  it("compares values after converting them to the attribute's type", () => {
    const { zones } = buildZones(
      [
        aZone({ label: "NORTH", customAttributes: { AREA: 1, POP: 1 } }),
        aZone({ label: "NORTH", customAttributes: { AREA: "1", POP: "1.0" } }),
      ],
      aZoneFactory(),
      plan,
    );

    expect(zones.size).toBe(1);
    expect(zones.get(1)!.getProperty("custom-1")).toBe("1");
    expect(zones.get(1)!.getProperty("custom-2")).toBe(1);
  });

  it("leaves out attributes the plan does not name", () => {
    const { zones } = buildZones(
      [aZone({ label: "NORTH", customAttributes: { OTHER: "LOW" } })],
      aZoneFactory(),
      plan,
    );

    expect(zones.get(1)!.listProperties()).toEqual(["label"]);
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

const plan: ZoneAttributePlan = new Map([
  ["AREA", { id: "custom-1", type: "text" }],
  ["POP", { id: "custom-2", type: "number" }],
]);

const aZoneFactory = () => new ZoneFactory(new ConsecutiveIdsGenerator());

const aZone = (
  data: Partial<ZoneData> = {},
  ring: Position[] = square,
): ZoneData => ({
  ref: "1",
  polygons: [[ring]],
  ...data,
});
