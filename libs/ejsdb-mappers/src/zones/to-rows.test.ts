import { describe, it, expect } from "vitest";
import type { Zones } from "@epanet-js/hydraulic-model";
import { zonesToRows } from "./to-rows";
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

describe("zonesToRows", () => {
  it("produces rows that round-trip through buildZonesData", () => {
    const zones = validZones();

    const rows = zonesToRows(zones);

    expect(buildZonesData(rows)).toEqual(zones);
  });

  it("throws when a row does not match the schema", () => {
    const zones: Zones = new Map([
      [1, { ...validZones().get(1)!, label: 42 as unknown as string }],
    ]);

    expect(() => zonesToRows(zones)).toThrow(
      /Zone 1 \(42\): row does not match schema/,
    );
  });

  it("throws when a coordinate is not a finite number", () => {
    const zone = validZones().get(1)!;
    const zones: Zones = new Map([
      [
        1,
        {
          ...zone,
          geometry: { type: "MultiPolygon", coordinates: [[[[0, NaN]]]] },
        },
      ],
    ]);

    expect(() => zonesToRows(zones)).toThrow(
      /Zone 1 \(Z1\): geometry must be a MultiPolygon of finite-number positions/,
    );
  });
});

describe("buildZonesData", () => {
  const aRow = (overrides: Record<string, unknown>) => ({
    ...zonesToRows(validZones())[0],
    ...overrides,
  });

  it("throws when the geometry is not valid JSON", () => {
    expect(() => buildZonesData([aRow({ geometry: "{" })])).toThrow(
      /Zone 1 \(Z1\): geometry is not valid JSON/,
    );
  });

  it("throws when the geometry is not a MultiPolygon", () => {
    const geometry = JSON.stringify({ type: "Point", coordinates: [0, 0] });

    expect(() => buildZonesData([aRow({ geometry })])).toThrow(
      /Zone 1 \(Z1\): geometry must be a MultiPolygon of finite-number positions/,
    );
  });

  it("throws when the bbox is not an array of numbers", () => {
    expect(() =>
      buildZonesData([aRow({ bbox: JSON.stringify([0, 0, "1", 1]) })]),
    ).toThrow(/Zone 1 \(Z1\): bbox must be an array of finite numbers/);
  });
});
