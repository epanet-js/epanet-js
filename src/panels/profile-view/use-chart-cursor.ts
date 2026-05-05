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
import { pickSldSnap, SNAP_PIXEL_THRESHOLD } from "./snap";

export { SNAP_PIXEL_THRESHOLD };

export type ChartCursorState = {
  px: number;
  py: number;
  content: VisibleTooltipContent;
} | null;

export type HoverMarker = {
  coordinates: [number, number];
  nodeType?: ProfilePoint["nodeType"];
  linkType?: ProfileLink["type"];
};

interface UseChartCursorParams {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: RefObject<any>;
  points: ProfilePoint[];
  links: ProfileLink[];
  terrain: TerrainPoint[] | null;
  pressureFactor: number | null;
  pathSegments: PathSegment[];
  setHoverHighlight: (marker: HoverMarker | null) => void;
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
      (marker: HoverMarker | null) => {
        depsRef.current.setHoverHighlight(marker);
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
      const snap = pickSldSnap(chart, deps.points, deps.links, px);

      const effectivePixelX = snap?.pixelX ?? px;
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
      const inSldGrid = chart.containPixel({ gridIndex: 1 }, [px, py]);
      const inMainGrid = chart.containPixel({ gridIndex: 0 }, [px, py]);

      let cursorStyle: "pointer" | "grab" | "default" = "default";
      if (snap !== null) {
        cursorStyle = "pointer";
      } else if (inSldGrid) {
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

      let marker: HoverMarker | null = null;
      if (snap?.kind === "node") {
        marker = {
          coordinates: deps.points[snap.index].coordinates,
          nodeType: deps.points[snap.index].nodeType,
        };
      } else if (snap?.kind === "link") {
        const coordinates = coordinatesAtLength(
          deps.pathSegments,
          snap.link.midLength,
        );
        if (coordinates) marker = { coordinates, linkType: snap.link.type };
      } else {
        const coordinates = coordinatesAtLength(deps.pathSegments, cursorX);
        if (coordinates) marker = { coordinates };
      }
      scheduleHover(marker);

      const content = getTooltipContent(
        cursorX,
        snap,
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
