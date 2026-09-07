/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import type { Table } from "@tanstack/react-table";
import { useScrollActiveCellIntoView } from "./use-scroll-active-cell-into-view";

type Row = Record<string, unknown>;

const aTable = (activeCell: { col: number; row: number } | null) =>
  ({
    getActiveCell: () => activeCell,
    getAllLeafColumns: () => [{ getSize: () => 100 }, { getSize: () => 100 }],
  }) as unknown as Table<Row>;

const aScrollElement = (scrollTop: number) => {
  const element = document.createElement("div");
  element.scrollTop = scrollTop;
  return element;
};

describe("useScrollActiveCellIntoView", () => {
  it("leaves the restored scroll position alone on mount", () => {
    const element = aScrollElement(500);
    const scrollRef = { current: element };

    renderHook(() =>
      useScrollActiveCellIntoView({
        scrollRef,
        table: aTable({ col: 0, row: 20 }),
        gutterColumn: false,
        rowHeight: 24,
      }),
    );

    expect(element.scrollTop).toEqual(500);
  });

  it("scrolls once the cursor actually moves", () => {
    const element = aScrollElement(0);
    const scrollRef = { current: element };
    let activeCell = { col: 0, row: 1 };

    const { rerender } = renderHook(() =>
      useScrollActiveCellIntoView({
        scrollRef,
        table: aTable(activeCell),
        gutterColumn: false,
        rowHeight: 24,
      }),
    );

    activeCell = { col: 0, row: 40 };
    rerender();

    expect(element.scrollTop).toBeGreaterThan(0);
  });
});
