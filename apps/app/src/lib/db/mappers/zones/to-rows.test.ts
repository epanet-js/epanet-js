import { describe, it, expect } from "vitest";
import type { Zones } from "src/lib/zones";
import { serializeZones } from "./to-rows";
import { buildZonesData } from "./builders";

const validZones = (): Zones =>
  new Map([
    [
      1,
      {
        id: 1,
        label: "Z1",
        geometry: {
          type: "MultiPolygon" as const,
          coordinates: [
            [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          ],
        },
        bbox: [0, 0, 1, 1] as [number, number, number, number],
      },
    ],
  ]);

describe("serializeZones", () => {
  it("produces rows that round-trip through buildZonesData", () => {
    const zones = validZones();

    const rows = serializeZones(zones);

    expect(buildZonesData(rows)).toEqual(zones);
  });

  it("throws when a row does not match the schema", () => {
    const zones: Zones = new Map([
      [1, { ...validZones().get(1)!, label: 42 as unknown as string }],
    ]);

    expect(() => serializeZones(zones)).toThrow(
      /Zone: row data does not match schema/,
    );
  });
});
