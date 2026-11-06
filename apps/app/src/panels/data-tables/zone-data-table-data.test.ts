import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { buildZoneModelRows } from "./zone-data-table-data";

const aSquare = (x: number) => ({
  geometry: {
    type: "MultiPolygon" as const,
    coordinates: [
      [
        [
          [x, 0],
          [x + 1, 0],
          [x + 1, 1],
          [x, 1],
          [x, 0],
        ],
      ],
    ],
  },
  bbox: [x, 0, x + 1, 1] as [number, number, number, number],
});

const buildModel = () =>
  HydraulicModelBuilder.with()
    .aZone({ id: 1, label: "NORTH", ...aSquare(0) })
    .aZone({ id: 2, label: "SOUTH", ...aSquare(5) })
    .build();

describe("buildZoneModelRows", () => {
  it("returns the zones with their ids and labels", () => {
    const rows = buildZoneModelRows(buildModel());

    expect(rows.map((r) => [r.id, r.label])).toEqual([
      [1, "NORTH"],
      [2, "SOUTH"],
    ]);
  });

  it("keeps only the scoped zones", () => {
    const rows = buildZoneModelRows(buildModel(), new Set([2]));

    expect(rows.map((r) => r.id)).toEqual([2]);
  });
});
