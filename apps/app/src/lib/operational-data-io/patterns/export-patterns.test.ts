import Papa from "papaparse";
import type { Pattern, PatternType, Patterns } from "src/hydraulic-model";
import {
  buildPatternRows,
  serializePatternsToCsv,
  type ExportPatternsOptions,
} from "./export-patterns";

const labels: Record<PatternType, string> = {
  demand: "Demand",
  reservoirHead: "Reservoir head",
  pumpSpeed: "Pump speed",
  qualitySourceStrength: "Quality source strength",
  energyPrice: "Energy price",
};

const options = (
  overrides: Partial<ExportPatternsOptions> = {},
): ExportPatternsOptions => ({
  typeLabels: labels,
  intervalSeconds: 3600,
  headers: {
    patternName: "Pattern name",
    type: "Type",
    interval: "Interval",
    multipliers: "Multipliers",
  },
  ...overrides,
});

const patternsOf = (...items: Pattern[]): Patterns =>
  new Map(items.map((p) => [p.id, p]));

describe("buildPatternRows", () => {
  it("writes one row per pattern with the multipliers along the row", () => {
    const patterns = patternsOf(
      { id: 1, label: "PAT1", type: "demand", multipliers: [0.8, 1.2, 1.4] },
      { id: 2, label: "PAT2", type: "pumpSpeed", multipliers: [1, 1.1] },
    );

    expect(buildPatternRows(patterns, options())).toEqual([
      ["Pattern name", "Type", "Interval", "Multipliers"],
      ["PAT1", "Demand", "1:00", 0.8, 1.2, 1.4],
      ["PAT2", "Pump speed", "1:00", 1, 1.1],
    ]);
  });

  it("writes a blank Type cell for uncategorized patterns", () => {
    const patterns = patternsOf({ id: 1, label: "PAT1", multipliers: [1] });

    expect(buildPatternRows(patterns, options())[1]).toEqual([
      "PAT1",
      "",
      "1:00",
      1,
    ]);
  });

  it("writes every pattern type the dialog holds", () => {
    const patterns = patternsOf(
      { id: 1, label: "PAT1", type: "demand", multipliers: [1] },
      { id: 2, label: "PAT2", type: "energyPrice", multipliers: [1] },
      { id: 3, label: "PAT3", multipliers: [1] },
    );

    const rows = buildPatternRows(patterns, options());

    expect(rows.slice(1).map((row) => [row[0], row[1]])).toEqual([
      ["PAT1", "Demand"],
      ["PAT2", "Energy price"],
      ["PAT3", ""],
    ]);
  });

  it("formats the interval as H:MM", () => {
    const patterns = patternsOf({
      id: 1,
      label: "PAT1",
      type: "demand",
      multipliers: [1],
    });

    const rows = buildPatternRows(patterns, options({ intervalSeconds: 1800 }));

    expect(rows[1][2]).toEqual("0:30");
  });
});

describe("serializePatternsToCsv", () => {
  it("lets each row run only as long as its own multipliers", () => {
    const patterns = patternsOf(
      { id: 1, label: "SHORT", type: "demand", multipliers: [1] },
      { id: 2, label: "LONG", type: "demand", multipliers: [1, 2, 3] },
    );

    const rows = Papa.parse<string[]>(
      serializePatternsToCsv(patterns, options()),
      { header: false, skipEmptyLines: true },
    ).data;

    expect(rows).toEqual([
      ["Pattern name", "Type", "Interval", "Multipliers"],
      ["SHORT", "Demand", "1:00", "1"],
      ["LONG", "Demand", "1:00", "1", "2", "3"],
    ]);
  });

  it("writes only a header row when there are no patterns", () => {
    expect(serializePatternsToCsv(new Map(), options())).toEqual(
      "Pattern name,Type,Interval,Multipliers",
    );
  });
});
