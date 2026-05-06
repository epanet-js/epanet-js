"use client";
import { useEffect, useRef, type RefObject } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { selectionAtom } from "src/state/selection";
import { tabAtom, TabOption } from "src/state/layout";
import { Mode, modeAtom } from "src/state/mode";
import { USelection } from "src/selection/selection";
import { ProfileLink, ProfilePoint } from "./chart-data";
import { findLinkAt } from "./tooltip-data";
import { isNearMainPlotLine, pickSldSnap } from "./snap";

interface UseChartClickParams {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: RefObject<any>;
  points: ProfilePoint[];
  links: ProfileLink[];
}

const DRAG_THRESHOLD_PX = 4;

export function useChartClick({
  containerRef,
  chartRef,
  points,
  links,
}: UseChartClickParams): void {
  const selection = useAtomValue(selectionAtom);
  const setSelection = useSetAtom(selectionAtom);
  const setTab = useSetAtom(tabAtom);
  const setMode = useSetAtom(modeAtom);

  const depsRef = useRef({
    points,
    links,
    selection,
    setSelection,
    setTab,
    setMode,
  });
  depsRef.current = {
    points,
    links,
    selection,
    setSelection,
    setTab,
    setMode,
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let mouseDownPos: { x: number; y: number } | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      mouseDownPos = { x: e.clientX, y: e.clientY };
    };

    const handleClick = (e: MouseEvent) => {
      const start = mouseDownPos;
      mouseDownPos = null;
      if (start) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) return;
      }

      const chart = chartRef.current;
      if (!chart) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      /* eslint-disable @typescript-eslint/no-unsafe-call,
         @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-assignment */
      const result =
        chart.convertFromPixel({ gridIndex: 0 }, [px, py]) ??
        chart.convertFromPixel({ seriesIndex: 0 }, [px, py]);
      const cursorX = Array.isArray(result) ? (result[0] as number) : NaN;
      if (Number.isNaN(cursorX)) return;

      const deps = depsRef.current;
      const snap = pickSldSnap(chart, deps.points, deps.links, px);
      const inSldGrid = chart.containPixel({ gridIndex: 1 }, [px, py]);
      const inMainGrid = chart.containPixel({ gridIndex: 0 }, [px, py]);
      /* eslint-enable */

      if (snap?.kind === "link") {
        deps.setSelection(
          USelection.toggleSingleSelectionId(deps.selection, snap.link.linkId),
        );
        deps.setTab(TabOption.Asset);
        deps.setMode({ mode: Mode.NONE });
        return;
      }

      if (snap?.kind === "node") {
        deps.setSelection(
          USelection.toggleSingleSelectionId(
            deps.selection,
            deps.points[snap.index].nodeId,
          ),
        );
        deps.setTab(TabOption.Asset);
        deps.setMode({ mode: Mode.NONE });
        return;
      }

      const link = findLinkAt(cursorX, deps.links);
      if (!link) return;

      const isOverSelectable =
        (inSldGrid && link !== null) ||
        (inMainGrid && isNearMainPlotLine(chart, cursorX, py, deps.points));
      if (!isOverSelectable) return;

      deps.setSelection(
        USelection.toggleSingleSelectionId(deps.selection, link.linkId),
      );
      deps.setTab(TabOption.Asset);
      deps.setMode({ mode: Mode.NONE });
    };

    el.addEventListener("mousedown", handleMouseDown);
    el.addEventListener("click", handleClick);
    return () => {
      el.removeEventListener("mousedown", handleMouseDown);
      el.removeEventListener("click", handleClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
