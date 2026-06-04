"use client";
import { useEffect, useRef, type RefObject } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { selectionAtom } from "src/state/selection";
import { tabAtom, TabOption } from "src/state/layout";
import { Mode, modeAtom } from "src/state/mode";
import { ephemeralStateAtom } from "src/state/drawing";
import { USelection, type Sel } from "src/selection";
import { useUserTracking } from "src/infra/user-tracking";
import { ProfileLink, ProfilePoint } from "./chart-data";
import { findLinkAt } from "./tooltip-data";
import { isNearMainPlotLine, pickSldSnap } from "./snap";
import type { SldVisibility } from "./sld/visibility";

interface UseChartClickParams {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: RefObject<any>;
  points: ProfilePoint[];
  links: ProfileLink[];
  sldVisibility: SldVisibility;
}

const DRAG_THRESHOLD_PX = 4;

export function useChartClick({
  containerRef,
  chartRef,
  points,
  links,
  sldVisibility,
}: UseChartClickParams): void {
  const selection = useAtomValue(selectionAtom);
  const setSelection = useSetAtom(selectionAtom);
  const setTab = useSetAtom(tabAtom);
  const { mode } = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const userTracking = useUserTracking();

  const depsRef = useRef({
    points,
    links,
    selection,
    setSelection,
    setTab,
    mode,
    setMode,
    setEphemeralState,
    sldVisibility,
    userTracking,
  });
  depsRef.current = {
    points,
    links,
    selection,
    setSelection,
    setTab,
    mode,
    setMode,
    setEphemeralState,
    sldVisibility,
    userTracking,
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
      const snap = pickSldSnap(
        chart,
        deps.points,
        deps.links,
        px,
        deps.sldVisibility,
      );
      const inSldGrid = chart.containPixel({ gridIndex: 1 }, [px, py]);
      const inMainGrid = chart.containPixel({ gridIndex: 0 }, [px, py]);
      /* eslint-enable */

      const shift = e.shiftKey;
      const grid: "main" | "sld" = inSldGrid ? "sld" : "main";

      const selectAsset = (id: number) => {
        const next: Sel = shift
          ? USelection.isSelected(deps.selection, id)
            ? USelection.removeFeatureFromSelection(deps.selection, id)
            : USelection.addSelectionId(deps.selection, id)
          : USelection.toggleSingleSelectionId(deps.selection, id);
        deps.setSelection(next);
        deps.setTab(TabOption.Asset);
        if (deps.mode === Mode.HGL_PROFILE) {
          deps.setEphemeralState({ type: "none" });
        }
        deps.setMode({ mode: Mode.NONE });
      };

      if (snap?.kind === "link") {
        deps.userTracking.capture({
          name: "profileView.assetSelectedFromChart",
          kind: "link",
          assetType: snap.link.type,
          grid,
        });
        selectAsset(snap.link.linkId);
        return;
      }

      if (snap?.kind === "node") {
        const point = deps.points[snap.index];
        deps.userTracking.capture({
          name: "profileView.assetSelectedFromChart",
          kind: "node",
          assetType: point.nodeType,
          grid,
        });
        selectAsset(point.nodeId);
        return;
      }

      const link = findLinkAt(cursorX, deps.links);
      if (!link) return;

      const isOverSelectable =
        (inSldGrid && link !== null) ||
        (inMainGrid && isNearMainPlotLine(chart, cursorX, py, deps.points));
      if (!isOverSelectable) return;

      deps.userTracking.capture({
        name: "profileView.assetSelectedFromChart",
        kind: "link",
        assetType: link.type,
        grid,
      });
      selectAsset(link.linkId);
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
