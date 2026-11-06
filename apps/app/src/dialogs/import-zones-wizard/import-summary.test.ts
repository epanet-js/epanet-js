import { describe, expect, it } from "vitest";
import type { ZoneData } from "@epanet-js/converters";
import { buildZones, type ZoneAttributePlan } from "@epanet-js/converters";
import { ZoneFactory } from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { buildSummaryRows } from "./import-summary";

const plan: ZoneAttributePlan = new Map([
  ["AREA", { id: "custom-1", type: "text" }],
]);
const columns = [{ id: "custom-1", label: "AREA" }];

const aZone = (label: string, area?: string): ZoneData => ({
  ref: "0",
  label,
  polygons: [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  ],
  ...(area === undefined ? {} : { customAttributes: { AREA: area } }),
});

const build = (records: ZoneData[]) =>
  buildZones(records, new ZoneFactory(new ConsecutiveIdsGenerator()), plan);

describe("buildSummaryRows", () => {
  it("lists merged zones with their values and feature count", () => {
    const rows = buildSummaryRows(
      build([aZone("NORTH", "LOW"), aZone("NORTH"), aZone("SOUTH", "LOW")]),
      columns,
    );

    expect(rows).toEqual([
      { label: "NORTH", values: ["LOW"], featureCount: 2 },
    ]);
  });

  it("puts a renamed zone next to the zone whose label it shared", () => {
    const rows = buildSummaryRows(
      build([
        aZone("NORTH", "LOW"),
        aZone("SOUTH", "LOW"),
        aZone("SOUTH", "LOW"),
        aZone("NORTH", "HIGH"),
      ]),
      columns,
    );

    expect(rows).toEqual([
      { label: "NORTH", values: ["LOW"], featureCount: 1 },
      { label: "NORTH_1", values: ["HIGH"], featureCount: 1 },
      { label: "SOUTH", values: ["LOW"], featureCount: 2 },
    ]);
  });

  it("leaves a value empty when the zone has none", () => {
    const rows = buildSummaryRows(
      build([aZone("NORTH"), aZone("NORTH")]),
      columns,
    );

    expect(rows).toEqual([{ label: "NORTH", values: [null], featureCount: 2 }]);
  });
});
