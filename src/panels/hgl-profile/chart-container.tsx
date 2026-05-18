"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import * as CM from "@radix-ui/react-context-menu";
import { useAtomValue, useSetAtom } from "jotai";
import debounce from "lodash/debounce";
import { HglProfileData } from "./chart-data";
import { ProfileContextMenu } from "./profile-context-menu";
import {
  X_AXIS_LABEL_MARGIN,
  Y_AXIS_LABEL_MARGIN,
  buildProfileChartOption,
  profileGridTopOffset,
} from "./chart-options";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { linkSymbologyAtom, nodeSymbologyAtom } from "src/state/map-symbology";
import { highlightsAtom } from "src/state/highlights";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection/selection";
import { traceDuration } from "src/infra/with-instrumentation";
import { isDebugOn } from "src/infra/debug-mode";
import { ProfileTooltip } from "./profile-tooltip";
import { useChartCursor, type HoverMarker } from "./use-chart-cursor";
import { useChartClick } from "./use-chart-click";
import { useChartZoomToSelection } from "./use-chart-zoom-to-selection";
import { useChartWheelZoom } from "./use-chart-wheel-zoom";
import { buildMainPlotSeries } from "./main-plot/series";
import { computeYAxisRange } from "./main-plot/y-axis-range";
import { buildSldSeries } from "./sld/series";
import { useSldIcons } from "./sld/use-sld-icons";
import { computeSldVisibility } from "./sld/visibility";

const STRIP_FADE_WIDTH = 24;

interface ChartContainerProps {
  data: HglProfileData;
  pathIds: number[];
}

export const ChartContainer = memo(function ChartContainer({
  data,
  pathIds,
}: ChartContainerProps) {
  const {
    points,
    links,
    hglRanges,
    terrain,
    pathSegments,
    pathHighlights,
    elevationData,
    hglData,
    terrainData,
    hglBandSegments,
    hglDropsData,
    nodePositions,
    totalLength,
    hasSimulation,
    pressureFactor,
    elevationUnit,
    pressureUnit,
    elevationDecimals,
    pressureDecimals,
    lengthDecimals,
    isUnprojected,
  } = data;

  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const linkSymbology = useAtomValue(linkSymbologyAtom);
  const nodeSymbology = useAtomValue(nodeSymbologyAtom);
  const sldIcons = useSldIcons();
  const setHighlights = useSetAtom(highlightsAtom);
  const selection = useAtomValue(selectionAtom);

  const linkColor = linkSymbology.defaults.color;
  const nodeColor = nodeSymbology.defaults.color;

  const selectedIds = useMemo(
    () => new Set<number>(USelection.toIds(selection)),
    [selection],
  );

  const setHoverHighlight = useCallback(
    (marker: HoverMarker | null) => {
      if (!marker) {
        setHighlights([]);
        return;
      }
      setHighlights([
        ...pathHighlights,
        {
          type: "marker",
          coordinates: marker.coordinates,
          nodeType: marker.nodeType,
          linkType: marker.linkType,
        },
      ]);
    },
    [setHighlights, pathHighlights],
  );

  const yAxisRange = useMemo(
    () => computeYAxisRange({ points, terrainData, hglRanges }),
    [points, terrainData, hglRanges],
  );

  const sldY = (yAxisRange.min + yAxisRange.max) / 2;

  const mainSeries = useMemo(
    () =>
      buildMainPlotSeries({
        points,
        elevationData,
        hglData,
        terrainData,
        hglBandSegments,
        hglDropsData,
        hasSimulation,
        yAxisMin: yAxisRange.min,
        linkColor,
        nodeColor,
        elevationLabel: translate("hglProfile.elevation"),
        hglLabel: translate("hglProfile.hgl"),
      }),
    [
      points,
      elevationData,
      hglData,
      terrainData,
      hglBandSegments,
      hglDropsData,
      hasSimulation,
      yAxisRange.min,
      linkColor,
      nodeColor,
      translate,
    ],
  );

  const profileGridTop = profileGridTopOffset(hasSimulation);

  const zoomRef = useRef<{ start: number; end: number }>({
    start: 0,
    end: 100,
  });
  const [zoomWindow, setZoomWindow] = useState<{ start: number; end: number }>({
    start: 0,
    end: 100,
  });
  const [settledZoom, setSettledZoom] = useState<{
    start: number;
    end: number;
  }>({ start: 0, end: 100 });
  const debouncedSetSettled = useMemo(
    () => debounce(setSettledZoom, 200, { leading: false, trailing: true }),
    [],
  );
  useEffect(() => () => debouncedSetSettled.cancel(), [debouncedSetSettled]);

  const [fadeBounds, setFadeBounds] = useState<{
    left: number;
    right: number;
    top: number;
    height: number;
    stripWidth: number;
    mainLeft: number;
    mainBottom: number;
  } | null>(null);

  const sldVisibility = useMemo(
    () =>
      computeSldVisibility({
        points,
        links,
        zoomStart: settledZoom.start,
        zoomEnd: settledZoom.end,
        totalLength,
        stripPixelWidth: fadeBounds?.stripWidth ?? null,
      }),
    [
      points,
      links,
      settledZoom.start,
      settledZoom.end,
      totalLength,
      fadeBounds?.stripWidth,
    ],
  );

  const sldSeries = useMemo(
    () =>
      buildSldSeries({
        points,
        links,
        sldY,
        pipeColor: linkColor,
        nodeColor,
        sldIcons,
        selectedIds,
        visibility: sldVisibility,
      }),
    [
      points,
      links,
      sldY,
      linkColor,
      nodeColor,
      sldIcons,
      selectedIds,
      sldVisibility,
    ],
  );

  const elevationUnitLabel = translateUnit(elevationUnit);
  const pressureUnitLabel = translateUnit(pressureUnit);
  const unitLabel = elevationUnitLabel;

  const option: EChartsOption = useMemo(
    () =>
      traceDuration("DEBUG PROFILE_CHART:option", () =>
        buildProfileChartOption({
          series: [...mainSeries, ...sldSeries],
          xTickPositions: nodePositions,
          xMax: totalLength,
          yMin: yAxisRange.min,
          yMax: yAxisRange.max,
          yInterval: yAxisRange.interval,
          profileGridTop,
          zoomStart: zoomRef.current.start,
          zoomEnd: zoomRef.current.end,
          lengthDecimals,
          elevationDecimals,
        }),
      ),
    [
      mainSeries,
      sldSeries,
      nodePositions,
      totalLength,
      yAxisRange,
      profileGridTop,
      lengthDecimals,
      elevationDecimals,
    ],
  );

  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const recomputeFadeBounds = useCallback(() => {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access,
       @typescript-eslint/no-unsafe-assignment,
       @typescript-eslint/no-unsafe-call */
    const chart = chartRef.current;
    if (!chart || totalLength <= 0) {
      setFadeBounds(null);
      return;
    }
    const model = chart.getModel?.();
    const stripRect = model
      ?.getComponent?.("grid", 1)
      ?.coordinateSystem?.getRect?.();
    const mainRect = model
      ?.getComponent?.("grid", 0)
      ?.coordinateSystem?.getRect?.();
    if (!stripRect || !mainRect) return;
    const left = stripRect.x;
    const right = stripRect.x + stripRect.width;
    const top = stripRect.y;
    const height = mainRect.y + mainRect.height - top;
    const stripWidth = stripRect.width;
    const mainLeft = mainRect.x;
    const mainBottom = mainRect.y + mainRect.height;
    setFadeBounds((prev) =>
      prev &&
      prev.left === left &&
      prev.right === right &&
      prev.top === top &&
      prev.height === height &&
      prev.stripWidth === stripWidth &&
      prev.mainLeft === mainLeft &&
      prev.mainBottom === mainBottom
        ? prev
        : { left, right, top, height, stripWidth, mainLeft, mainBottom },
    );
    /* eslint-enable */
  }, [totalLength]);

  const onChartReady = useCallback((chart: any) => {
    chartRef.current = chart;
  }, []);

  const onDataZoom = useCallback(
    (params: any) => {
      /* eslint-disable @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-assignment */
      const batch = params?.batch?.[0] ?? params;
      if (typeof batch?.start === "number" && typeof batch?.end === "number") {
        zoomRef.current = { start: batch.start, end: batch.end };
        setZoomWindow({ start: batch.start, end: batch.end });
        debouncedSetSettled({ start: batch.start, end: batch.end });
      }
      /* eslint-enable */
    },
    [debouncedSetSettled],
  );

  const onEvents = useMemo(
    () => ({ datazoom: onDataZoom, finished: recomputeFadeBounds }),
    [onDataZoom, recomputeFadeBounds],
  );

  const observerRef = useRef<ResizeObserver | null>(null);
  const setContainerNode = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (el && typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => recomputeFadeBounds());
        observer.observe(el);
        observerRef.current = observer;
      }
    },
    [recomputeFadeBounds],
  );

  const cursorState = useChartCursor({
    containerRef,
    chartRef,
    points,
    links,
    terrain,
    pressureFactor,
    pathSegments,
    setHoverHighlight,
    allowEstimates: !isUnprojected,
    sldVisibility,
  });

  useChartClick({ containerRef, chartRef, points, links, sldVisibility });

  useChartZoomToSelection({ chartRef, zoomRef, points, links, totalLength });

  useChartWheelZoom({ containerRef, chartRef, zoomRef, totalLength });

  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const onContextMenuOpenChange = useCallback(
    (open: boolean) => {
      setIsContextMenuOpen(open);
      if (open) setHighlights([]);
    },
    [setHighlights],
  );

  if (isDebugOn) {
    //eslint-disable-next-line no-console
    console.log(
      `DEBUG PROFILE_CHART:render points=${points.length} links=${links?.length ?? 0}`,
    );
  }

  const hasHiddenLeft = zoomWindow.start > 0;
  const hasHiddenRight = zoomWindow.end < 100;

  return (
    <CM.Root modal={false} onOpenChange={onContextMenuOpenChange}>
      <CM.Trigger asChild>
        <div
          ref={setContainerNode}
          style={{
            position: "relative",
            height: "100%",
            width: "100%",
            overflow: "hidden",
          }}
        >
          <ReactECharts
            option={option}
            style={{ height: "100%", width: "100%" }}
            notMerge={true}
            onChartReady={onChartReady}
            onEvents={onEvents}
          />
          {fadeBounds && hasHiddenLeft && (
            <div
              aria-hidden
              className="profile-strip-fade-left"
              style={{
                top: fadeBounds.top,
                left: fadeBounds.left,
                width: STRIP_FADE_WIDTH,
                height: fadeBounds.height,
              }}
            />
          )}
          {fadeBounds && hasHiddenRight && (
            <div
              aria-hidden
              className="profile-strip-fade-right"
              style={{
                top: fadeBounds.top,
                left: fadeBounds.right - STRIP_FADE_WIDTH,
                width: STRIP_FADE_WIDTH,
                height: fadeBounds.height,
              }}
            />
          )}
          {fadeBounds && cursorState && !isContextMenuOpen && (
            <div
              aria-hidden
              className="profile-cursor-line"
              style={{
                top: fadeBounds.top,
                left: cursorState.cursorX,
                height: fadeBounds.height,
              }}
            />
          )}
          {fadeBounds && unitLabel && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: fadeBounds.mainBottom + X_AXIS_LABEL_MARGIN - 2,
                left: 0,
                width: fadeBounds.mainLeft - Y_AXIS_LABEL_MARGIN,
                textAlign: "right",
                fontSize: 12,
                lineHeight: 1,
                color: "#374151",
                pointerEvents: "none",
              }}
            >
              {unitLabel}
            </div>
          )}
          <ProfileTooltip
            state={isContextMenuOpen ? null : cursorState}
            containerRef={containerRef}
            elevColor={nodeColor}
            translate={translate}
            elevationUnitLabel={elevationUnitLabel}
            pressureUnitLabel={pressureUnitLabel}
            elevationDecimals={elevationDecimals}
            pressureDecimals={pressureDecimals}
          />
        </div>
      </CM.Trigger>
      <ProfileContextMenu pathIds={pathIds} />
    </CM.Root>
  );
});
