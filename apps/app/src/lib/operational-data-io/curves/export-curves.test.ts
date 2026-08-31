import Papa from "papaparse";
import type { CurveType, Curves, ICurve } from "@epanet-js/hydraulic-model";
import {
  buildCurveRows,
  serializeCurvesToCsv,
  type ExportCurvesOptions,
} from "./export-curves";

const typeLabels: Record<CurveType, string> = {
  pump: "Pump head",
  efficiency: "Pump efficiency",
  volume: "Tank volume",
  valve: "Valve",
  headloss: "Headloss",
};

const options = (
  overrides: Partial<ExportCurvesOptions> = {},
): ExportCurvesOptions => ({
  scope: ["volume", "valve", "headloss"],
  typeLabels,
  axisLabels: { x: "X", y: "Y" },
  headers: {
    curveName: "Curve name",
    type: "Type",
    axis: "Axis",
    values: "Values",
  },
  ...overrides,
});

const curvesOf = (...items: ICurve[]): Curves =>
  new Map(items.map((c) => [c.id, c]));

describe("buildCurveRows", () => {
  it("writes an X row and a Y row per curve", () => {
    const curves = curvesOf({
      id: 1,
      label: "C1",
      type: "volume",
      points: [
        { x: 0, y: 0 },
        { x: 1.5, y: 120 },
      ],
    });

    expect(buildCurveRows(curves, options())).toEqual([
      ["Curve name", "Type", "Axis", "Values"],
      ["C1", "Tank volume", "X", 0, 1.5],
      ["C1", "Tank volume", "Y", 0, 120],
    ]);
  });

  it("writes a blank Type cell for uncategorized curves", () => {
    const curves = curvesOf({ id: 1, label: "C1", points: [{ x: 0, y: 1 }] });

    expect(buildCurveRows(curves, options()).slice(1)).toEqual([
      ["C1", "", "X", 0],
      ["C1", "", "Y", 1],
    ]);
  });

  it("includes uncategorized curves alongside the dialog's own types", () => {
    const curves = curvesOf(
      { id: 1, label: "TYPED", type: "volume", points: [{ x: 0, y: 1 }] },
      { id: 2, label: "UNTYPED", points: [{ x: 0, y: 1 }] },
    );

    const names = buildCurveRows(curves, options())
      .slice(1)
      .map((r) => r[0]);

    expect(new Set(names)).toEqual(new Set(["TYPED", "UNTYPED"]));
  });

  it("excludes curves belonging to the other dialog", () => {
    const curves = curvesOf(
      { id: 1, label: "TANK", type: "volume", points: [{ x: 0, y: 1 }] },
      { id: 2, label: "PUMP", type: "pump", points: [{ x: 0, y: 1 }] },
    );

    const names = buildCurveRows(curves, options())
      .slice(1)
      .map((r) => r[0]);

    expect(new Set(names)).toEqual(new Set(["TANK"]));
  });

  it("exports pump types when that is the dialog's scope", () => {
    const curves = curvesOf(
      { id: 1, label: "TANK", type: "volume", points: [{ x: 0, y: 1 }] },
      { id: 2, label: "PUMP", type: "pump", points: [{ x: 0, y: 1 }] },
      { id: 3, label: "EFF", type: "efficiency", points: [{ x: 0, y: 1 }] },
    );

    const names = buildCurveRows(
      curves,
      options({ scope: ["pump", "efficiency"] }),
    )
      .slice(1)
      .map((r) => r[0]);

    expect(new Set(names)).toEqual(new Set(["PUMP", "EFF"]));
  });

  it("groups curves by type in the sidebar's order, uncategorized last", () => {
    const curves = curvesOf(
      { id: 1, label: "UNTYPED", points: [{ x: 0, y: 1 }] },
      { id: 2, label: "HEADLOSS", type: "headloss", points: [{ x: 0, y: 1 }] },
      { id: 3, label: "VOLUME_B", type: "volume", points: [{ x: 0, y: 1 }] },
      { id: 4, label: "VALVE", type: "valve", points: [{ x: 0, y: 1 }] },
      { id: 5, label: "VOLUME_A", type: "volume", points: [{ x: 0, y: 1 }] },
    );

    const names = buildCurveRows(curves, options())
      .slice(1)
      .filter((_, index) => index % 2 === 0)
      .map((row) => row[0]);

    expect(names).toEqual([
      "VOLUME_B",
      "VOLUME_A",
      "VALVE",
      "HEADLOSS",
      "UNTYPED",
    ]);
  });
});

describe("serializeCurvesToCsv", () => {
  it("lets each row run only as long as its own points", () => {
    const curves = curvesOf(
      { id: 1, label: "SHORT", type: "volume", points: [{ x: 0, y: 1 }] },
      {
        id: 2,
        label: "LONG",
        type: "volume",
        points: [
          { x: 0, y: 1 },
          { x: 2, y: 3 },
        ],
      },
    );

    const rows = Papa.parse<string[]>(serializeCurvesToCsv(curves, options()), {
      header: false,
      skipEmptyLines: true,
    }).data;

    expect(rows).toEqual([
      ["Curve name", "Type", "Axis", "Values"],
      ["SHORT", "Tank volume", "X", "0"],
      ["SHORT", "Tank volume", "Y", "1"],
      ["LONG", "Tank volume", "X", "0", "2"],
      ["LONG", "Tank volume", "Y", "1", "3"],
    ]);
  });

  it("writes only a header row when there are no curves in scope", () => {
    expect(serializeCurvesToCsv(new Map(), options())).toEqual(
      "Curve name,Type,Axis,Values",
    );
  });
});
