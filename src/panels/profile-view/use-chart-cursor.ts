"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import throttle from "lodash/throttle";
import { ProfileLink, ProfilePoint, TerrainPoint } from "./chart-data";
import { coordinatesAtLength, PathSegment } from "./path-position";
import { getTooltipContent, VisibleTooltipContent } from "./tooltip-data";

const SNAP_PIXEL_THRESHOLD = 5;

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
