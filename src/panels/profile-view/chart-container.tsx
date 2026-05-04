"use client";
import { memo, useCallback, useMemo, useRef } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useAtomValue, useSetAtom } from "jotai";
import { ProfileViewData } from "./chart-data";
import { buildProfileChartOption, profileGridTopOffset } from "./chart-options";
import { useTranslate } from "src/hooks/use-translate";
import { linkSymbologyAtom, nodeSymbologyAtom } from "src/state/map-symbology";
import { highlightsAtom } from "src/state/highlights";
import { traceDuration } from "src/infra/with-instrumentation";
import { isDebugOn } from "src/infra/debug-mode";
import { ProfileTooltip } from "./profile-tooltip";
import { useChartCursor } from "./use-chart-cursor";
import { buildMainPlotSeries } from "./main-plot/series";
import { computeYAxisRange } from "./main-plot/y-axis-range";
import { useMainPlotClick } from "./main-plot/use-main-plot-click";
import { buildStripSeries } from "./strip-plot/series";
import { useStripPlanIcons } from "./strip-plot/use-strip-plan-icons";
import { useStripPlotClick } from "./strip-plot/use-strip-plot-click";

interface ChartContainerProps {
  data: ProfileViewData;
}

export const ChartContainer = memo(function ChartContainer({
  data,
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
  } = data;

  const translate = useTranslate();
  const linkSymbology = useAtomValue(linkSymbologyAtom);
  const nodeSymbology = useAtomValue(nodeSymbologyAtom);
  const stripIcons = useStripPlanIcons();
  const setHighlights = useSetAtom(highlightsAtom);

  const linkColor = linkSymbology.defaults.color;
  const nodeColor = nodeSymbology.defaults.color;

  const setHoverHighlight = useCallback(
    (coordinates: [number, number] | null) => {
      if (!coordinates) {
        setHighlights([]);
        return;
      }
      setHighlights([...pathHighlights, { type: "marker", coordinates }]);
    },
    [setHighlights, pathHighlights],
  );

  const yAxisRange = useMemo(
    () => computeYAxisRange({ points, terrainData, hglRanges }),
    [points, terrainData, hglRanges],
  );

  const stripY = (yAxisRange.min + yAxisRange.max) / 2;

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
        elevationLabel: translate("profileView.elevation"),
        hglLabel: translate("profileView.hgl"),
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

  const stripSeries = useMemo(
    () =>
      buildStripSeries({
        points,
        links,
        stripY,
        pipeColor: linkColor,
        nodeColor,
        stripIcons,
      }),
    [points, links, stripY, linkColor, nodeColor, stripIcons],
  );

  const profileGridTop = profileGridTopOffset(hasSimulation);

  const option: EChartsOption = useMemo(
    () =>
      traceDuration("DEBUG PROFILE_CHART:option", () =>
        buildProfileChartOption({
          series: [...mainSeries, ...stripSeries],
          xTickPositions: nodePositions,
          xMax: totalLength,
          yMin: yAxisRange.min,
          yMax: yAxisRange.max,
          yInterval: yAxisRange.interval,
          profileGridTop,
        }),
      ),
    [
      mainSeries,
      stripSeries,
      nodePositions,
      totalLength,
      yAxisRange,
      profileGridTop,
    ],
  );

  const onMainPlotClick = useMainPlotClick(points);
  const onStripPlotClick = useStripPlotClick();
  const onChartClick = useCallback(
    (params: any) => {
      const seriesName: string | undefined = params?.seriesName;
      if (typeof seriesName === "string" && seriesName.startsWith("strip")) {
        onStripPlotClick(params);
        return;
      }
      onMainPlotClick(params);
    },
    [onMainPlotClick, onStripPlotClick],
  );

  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onChartReady = useCallback((chart: any) => {
    chartRef.current = chart;
  }, []);

  const cursorState = useChartCursor({
    containerRef,
    chartRef,
    points,
    links,
    terrain,
    pressureFactor,
    pathSegments,
    setHoverHighlight,
  });

  if (isDebugOn) {
    //eslint-disable-next-line no-console
    console.log(
      `DEBUG PROFILE_CHART:render points=${points.length} links=${links?.length ?? 0}`,
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", height: "100%", width: "100%" }}
    >
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        notMerge={true}
        onEvents={{ click: onChartClick }}
        onChartReady={onChartReady}
      />
      <ProfileTooltip
        state={cursorState}
        elevColor={nodeColor}
        translate={translate}
      />
    </div>
  );
});
