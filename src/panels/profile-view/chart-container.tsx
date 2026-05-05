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
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection/selection";
import { traceDuration } from "src/infra/with-instrumentation";
import { isDebugOn } from "src/infra/debug-mode";
import { ProfileTooltip } from "./profile-tooltip";
import { useChartCursor, type HoverMarker } from "./use-chart-cursor";
import { useChartClick } from "./use-chart-click";
import { buildMainPlotSeries } from "./main-plot/series";
import { computeYAxisRange } from "./main-plot/y-axis-range";
import { buildSldSeries } from "./sld/series";
import { useSldIcons } from "./sld/use-sld-icons";

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
      }),
    [points, links, sldY, linkColor, nodeColor, sldIcons, selectedIds],
  );

  const profileGridTop = profileGridTopOffset(hasSimulation);

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
        }),
      ),
    [
      mainSeries,
      sldSeries,
      nodePositions,
      totalLength,
      yAxisRange,
      profileGridTop,
    ],
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

  useChartClick({ containerRef, chartRef, points, links });

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
