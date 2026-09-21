import { describe, it, expect } from "vitest";
import { encodeIdList } from "@epanet-js/ejsdb";
import type { SelectionSet } from "src/lib/collections";
import { USelection } from "src/selection";
import { serializeSelectionSets } from "./to-rows";
import { buildSelectionSetsData } from "./builders";

const aSelectionSet = (
  overrides: Partial<SelectionSet> = {},
): SelectionSet => ({
  id: "set-1",
  label: "Downtown loop",
  selection: USelection.fromIds([1, 2, 3], [4, 5]),
  ...overrides,
});

describe("serializeSelectionSets", () => {
  it("produces rows that round-trip through buildSelectionSetsData", () => {
    const selectionSets = [aSelectionSet()];

    const rows = serializeSelectionSets(selectionSets);

    expect(buildSelectionSetsData(rows)).toEqual(selectionSets);
  });

  it("round-trips a set with only assets and one with only customer points", () => {
    const selectionSets = [
      aSelectionSet({ id: "set-1", selection: USelection.fromIds([1, 2], []) }),
      aSelectionSet({ id: "set-2", selection: USelection.fromIds([], [7]) }),
    ];

    const rows = serializeSelectionSets(selectionSets);

    expect(buildSelectionSetsData(rows)).toEqual(selectionSets);
  });

  it("round-trips a set holding many ids", () => {
    const assetIds = Array.from({ length: 200000 }, (_, index) => index + 1);
    const selectionSets = [
      aSelectionSet({ selection: USelection.fromIds(assetIds, []) }),
    ];

    const rows = serializeSelectionSets(selectionSets);

    expect(buildSelectionSetsData(rows)).toEqual(selectionSets);
  });

  it("keeps the order the sets were given in", () => {
    const selectionSets = [
      aSelectionSet({ id: "set-1", label: "First" }),
      aSelectionSet({ id: "set-2", label: "Second" }),
    ];

    const rows = serializeSelectionSets(selectionSets);

    expect(rows.map((row) => row.label)).toEqual(["First", "Second"]);
  });

  it("refuses an id it cannot store instead of truncating it", () => {
    const selectionSets = [
      aSelectionSet({ selection: USelection.fromIds([2 ** 31], []) }),
    ];

    expect(() => serializeSelectionSets(selectionSets)).toThrow(
      /not a 32-bit integer/,
    );
  });

  it("refuses a set without a label", () => {
    const selectionSets = [aSelectionSet({ label: "" })];

    expect(() => serializeSelectionSets(selectionSets)).toThrow(
      /Selection set: row data does not match schema/,
    );
  });
});

describe("buildSelectionSetsData", () => {
  it("refuses a stored set it cannot read", () => {
    const rows = [
      {
        id: "set-1",
        label: "Readable",
        assets: encodeIdList([1]),
        customer_points: null,
      },
      {
        id: "set-2",
        label: "Broken",
        assets: new Uint8Array(6),
        customer_points: null,
      },
    ];

    expect(() => buildSelectionSetsData(rows)).toThrow(
      /Selection set: row data does not match schema/,
    );
  });

  it("reads a set stored without ids as an empty selection", () => {
    const rows = [
      { id: "set-1", label: "Empty", assets: null, customer_points: null },
    ];

    expect(buildSelectionSetsData(rows)).toEqual([
      { id: "set-1", label: "Empty", selection: USelection.none() },
    ]);
  });
});
