import { describe, it, expect } from "vitest";
import type { Table } from "@tanstack/react-table";
import { resolveDataIndex } from "./data-index";

const makeTable = (orderByDataIndex: Int32Array | null) =>
  ({
    getLazyRowOrder: () => ({ orderByDataIndex }),
  }) as unknown as Table<unknown>;

describe("resolveDataIndex", () => {
  it("returns the visual row unchanged when unsorted (identity order)", () => {
    const table = makeTable(null);
    expect(resolveDataIndex(table, 0)).toBe(0);
    expect(resolveDataIndex(table, 4)).toBe(4);
  });

  it("maps a visual row position to its original data index when sorted", () => {
    // Display order: visual 0 -> data 2, visual 1 -> data 0, visual 2 -> data 1.
    const table = makeTable(Int32Array.from([2, 0, 1]));
    expect(resolveDataIndex(table, 0)).toBe(2);
    expect(resolveDataIndex(table, 1)).toBe(0);
    expect(resolveDataIndex(table, 2)).toBe(1);
  });
});
