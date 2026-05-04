"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import throttle from "lodash/throttle";
import { ProfileLink, ProfilePoint, TerrainPoint } from "./chart-data";
import { coordinatesAtLength, PathSegment } from "./path-position";
import {
  findLinkAt,
  getTooltipContent,
  interpolateElevation,
  interpolateHgl,
  VisibleTooltipContent,
} from "./tooltip-data";

export const SNAP_PIXEL_THRESHOLD = 10;

export type ChartCursorState = {
  px: number;
  py: number;
  content: VisibleTooltipContent;
} | null;

interface UseChartCursorParams {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: RefObject<any>;
  points: ProfilePoint[];
  links: ProfileLink[];
  terrain: TerrainPoint[] | null;
  pressureFactor: number | null;
  pathSegments: PathSegment[];
  setHoverHighlight: (coordinates: [number, number] | null) => void;
}

export function useChartCursor({
  containerRef,
  chartRef,
  points,
  links,
  terrain,
  pressureFactor,
  pathSegments,
  setHoverHighlight,
}: UseChartCursorParams): ChartCursorState {
  const [cursorState, setCursorState] = useState<ChartCursorState>(null);

  const depsRef = useRef({
    points,
    links,
    terrain,
    pressureFactor,
    pathSegments,
    setHoverHighlight,
  });
  depsRef.current = {
    points,
    links,
    terrain,
    pressureFactor,
    pathSegments,
    setHoverHighlight,
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scheduleHover = throttle(
      (coords: [number, number] | null) => {
        depsRef.current.setHoverHighlight(coords);
      },
      100,
      { leading: false, trailing: true },
    );

    const handleMove = (e: MouseEvent) => {
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
      if (Number.isNaN(cursorX)) {
        chart.dispatchAction({
          type: "updateAxisPointer",
          currTrigger: "leave",
        });
        chart.getZr().setCursorStyle("default");
        setCursorState(null);
        scheduleHover(null);
        return;
      }

      const deps = depsRef.current;
      let snappedIdx: number | null = null;
      let snappedPixelX: number | null = null;
      let bestDist = SNAP_PIXEL_THRESHOLD;
      for (let i = 0; i < deps.points.length; i++) {
        const pointPx = chart.convertToPixel(
          { xAxisIndex: 0 },
          deps.points[i].cumulativeLength,
        );
        if (typeof pointPx !== "number" || Number.isNaN(pointPx)) continue;
        const d = Math.abs(pointPx - px);
        if (d <= bestDist) {
          bestDist = d;
          snappedIdx = i;
          snappedPixelX = pointPx;
        }
      }

      const effectivePixelX = snappedPixelX ?? px;
      chart.dispatchAction({
        type: "updateAxisPointer",
        currTrigger: "mousemove",
        x: effectivePixelX,
        y: py,
      });
      /* eslint-enable */

      /* eslint-disable @typescript-eslint/no-unsafe-call,
         @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-assignment */
      const inStripGrid = chart.containPixel({ gridIndex: 1 }, [px, py]);
      const inMainGrid = chart.containPixel({ gridIndex: 0 }, [px, py]);

      let cursorStyle: "pointer" | "grab" | "default" = "default";
      if (snappedIdx !== null) {
        cursorStyle = "pointer";
      } else if (inStripGrid) {
        cursorStyle =
          findLinkAt(cursorX, deps.links) !== null ? "pointer" : "grab";
      } else if (inMainGrid) {
        cursorStyle = isNearMainPlotLine(
          chart,
          cursorX,
          py,
          deps.points,
          SNAP_PIXEL_THRESHOLD,
        )
          ? "pointer"
          : "grab";
      }
      chart.getZr().setCursorStyle(cursorStyle);
      /* eslint-enable */

      const markerCoordinates =
        snappedIdx !== null
          ? deps.points[snappedIdx].coordinates
          : coordinatesAtLength(deps.pathSegments, cursorX);
      scheduleHover(markerCoordinates);

      const content = getTooltipContent(
        cursorX,
        snappedIdx,
        deps.points,
        deps.links,
        deps.terrain,
        deps.pressureFactor,
      );
      if (content.kind === "hidden") {
        setCursorState(null);
        return;
      }
      setCursorState({ px, py, content });
    };

    const handleLeave = () => {
      const chart = chartRef.current;
      if (chart) {
        /* eslint-disable @typescript-eslint/no-unsafe-call,
           @typescript-eslint/no-unsafe-member-access */
        chart.dispatchAction({
          type: "updateAxisPointer",
          currTrigger: "leave",
        });
        chart.getZr().setCursorStyle("default");
        /* eslint-enable */
      }
      setCursorState(null);
      scheduleHover(null);
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
      scheduleHover.cancel();
      depsRef.current.setHoverHighlight(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return cursorState;
}

function isNearMainPlotLine(
  chart: any,
  cursorX: number,
  py: number,
  points: ProfilePoint[],
  threshold: number,
): boolean {
  /* eslint-disable @typescript-eslint/no-unsafe-call,
     @typescript-eslint/no-unsafe-member-access,
     @typescript-eslint/no-unsafe-assignment */
  const elevation = interpolateElevation(cursorX, points);
  if (elevation !== null) {
    const elevPy = chart.convertToPixel({ yAxisIndex: 0 }, elevation);
    if (typeof elevPy === "number" && Math.abs(py - elevPy) <= threshold) {
      return true;
    }
  }
  const hgl = interpolateHgl(cursorX, points);
  if (hgl !== null) {
    const hglPy = chart.convertToPixel({ yAxisIndex: 0 }, hgl);
    if (typeof hglPy === "number" && Math.abs(py - hglPy) <= threshold) {
      return true;
    }
  }
  return false;
  /* eslint-enable */
}
