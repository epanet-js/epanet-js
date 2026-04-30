"use client";
import { memo, useCallback, useMemo, useRef } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useSetAtom } from "jotai";
import { ProfileViewData } from "./chart-data";
import {
  elevationDropsPlot,
  elevationLinePlot,
  hglBandPlot,
  hglDropsPlot,
  hglLinePlot,
  junctionsStripPlot,
  pipesStripPlot,
  pumpValvesStripPlot,
  pumpsStripPlot,
  reservoirsStripPlot,
  tanksStripPlot,
  terrainAreaPlot,
  valvesStripPlot,
} from "./plots";
import { useStripPlanIcons } from "./use-strip-plan-icons";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { selectionAtom } from "src/state/selection";
import { tabAtom, TabOption } from "src/state/layout";
import { linkSymbologyAtom, nodeSymbologyAtom } from "src/state/map-symbology";
import { highlightsAtom } from "src/state/highlights";
import { traceDuration } from "src/infra/with-instrumentation";
import { useAtomValue } from "jotai";
import { USelection } from "src/selection/selection";
import { ProfileTooltip } from "./profile-tooltip";

const STRIP_GRID_TOP = 6;
const STRIP_GRID_HEIGHT = 30;
const STRIP_PROFILE_GAP = 2;

function notNull<T>(value: T | null): value is T {
  return value !== null;
}

interface ProfileChartProps {
  data: ProfileViewData;
}

export const ProfileChart = memo(function ProfileChart({
  data,
}: ProfileChartProps) {
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
  const setSelection = useSetAtom(selectionAtom);
  const setTab = useSetAtom(tabAtom);
  const linkSymbology = useAtomValue(linkSymbologyAtom);
  const nodeSymbology = useAtomValue(nodeSymbologyAtom);
  const stripIcons = useStripPlanIcons();
  const setHighlights = useSetAtom(highlightsAtom);
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

  const onChartClick = useCallback(
    (params: any) => {
      const seriesName: string | undefined = params?.seriesName;
      const data = params?.data;

      if (typeof seriesName === "string" && seriesName.startsWith("strip")) {
        const linkId: number | undefined = data?.linkId;
        const nodeId: number | undefined = data?.nodeId;
        const assetId = linkId ?? nodeId;
        if (typeof assetId !== "number") return;
        setSelection(USelection.single(assetId));
        setTab(TabOption.Asset);
        return;
      }

      const idx: number | undefined = params?.dataIndex;
      if (typeof idx !== "number") return;
      const point = points[idx];
      if (!point) return;
      setSelection(USelection.single(point.nodeId));
      setTab(TabOption.Asset);
    },
    [points, setSelection, setTab],
  );

  // Compute Y axis range for exactly 10 evenly spaced tick values
  const yAxisRange = useMemo(() => {
    const vals: number[] = [];
    points.forEach((p, i) => {
      vals.push(p.elevation);
      if (p.head !== null) vals.push(p.head);
      const r = hglRanges?.[i];
      if (r) {
        vals.push(r.minHead);
        vals.push(r.maxHead);
      }
    });
    if (terrainData) {
      terrainData.forEach(([, v]) => {
        if (v !== null && v !== undefined) vals.push(v);
      });
    }
    if (vals.length === 0) return { min: 0, max: 100, interval: 100 / 9 };
    const dataMin = Math.min(...vals);
    const dataMax = Math.max(...vals);
    const span = dataMax - dataMin || 10;
    const padding = span * 0.08;
    const yMin = dataMin - padding;
    const yMax = dataMax + padding;
    return { min: yMin, max: yMax, interval: (yMax - yMin) / 9 };
  }, [points, terrainData, hglRanges]);

  // Light brown vertical drops: node elevation down to X axis
  const elevDropsData = useMemo(() => {
    const result: ([number, number] | null)[] = [];
    points.forEach((p) => {
      result.push([p.cumulativeLength, p.elevation]);
      result.push([p.cumulativeLength, yAxisRange.min]);
      result.push(null);
    });
    return result;
  }, [points, yAxisRange.min]);

  const series: EChartsOption["series"] = useMemo(() => {
    return traceDuration("DEBUG PROFILE_CHART:series", () => {
      const linkColor = linkSymbology.defaults.color;
      const nodeColor = nodeSymbology.defaults.color;
      return [
        terrainAreaPlot(terrainData),
        hglBandPlot(hglBandSegments),
        elevationDropsPlot(elevDropsData),
        elevationLinePlot(
          elevationData,
          linkColor,
          nodeColor,
          translate("profileView.elevation"),
        ),
        hasSimulation ? hglDropsPlot(hglDropsData) : null,
        hasSimulation
          ? hglLinePlot(hglData, translate("profileView.hgl"))
          : null,
      ].filter(notNull);
    });
  }, [
    translate,
    elevationData,
    hglData,
    hasSimulation,
    terrainData,
    hglDropsData,
    elevDropsData,
    hglBandSegments,
    linkSymbology.defaults.color,
    nodeSymbology.defaults.color,
  ]);

  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onChartReady = useCallback((chart: any) => {
    chartRef.current = chart;
  }, []);

  const stripY = (yAxisRange.min + yAxisRange.max) / 2;

  const stripSeries = useMemo<EChartsOption["series"]>(() => {
    return traceDuration("DEBUG PROFILE_CHART:stripSeries", () => {
      if (links.length === 0) return [];
      const pipeColor = linkSymbology.defaults.color;
      const nodeColor = nodeSymbology.defaults.color;
      return [
        pipesStripPlot(links, pipeColor, stripY),
        pumpValvesStripPlot(links, stripY),
        junctionsStripPlot(points, nodeColor, stripY),
        tanksStripPlot(points, stripIcons, stripY),
        reservoirsStripPlot(points, stripIcons, stripY),
        pumpsStripPlot(links, stripIcons, stripY),
        valvesStripPlot(links, stripIcons, stripY),
      ].filter(notNull);
    });
  }, [
    links,
    points,
    stripY,
    linkSymbology.defaults.color,
    nodeSymbology.defaults.color,
    stripIcons,
  ]);

  const profileGridTop =
    STRIP_GRID_TOP +
    STRIP_GRID_HEIGHT +
    STRIP_PROFILE_GAP +
    (hasSimulation ? 4 : 0);

  const option: EChartsOption = useMemo(
    () =>
      traceDuration("DEBUG PROFILE_CHART:option", () => ({
        animation: false,
        grid: [
          {
            top: profileGridTop,
            right: 12,
            bottom: 12,
            left: 12,
            containLabel: true,
          },
          {
            top: STRIP_GRID_TOP,
            height: STRIP_GRID_HEIGHT,
            right: 12,
            left: 12,
            containLabel: true,
          },
        ],
        xAxis: [
          {
            type: "value",
            min: 0,
            max: totalLength,
            nameLocation: "middle",
            splitLine: { show: true, lineStyle: { color: "#e5e7eb" } },
            axisTick: { customValues: nodePositions } as any,
            axisLabel: {
              hideOverlap: true,
              customValues: nodePositions,
              formatter: (val: number) => localizeDecimal(val, { decimals: 0 }),
            } as any,
            axisPointer: {
              show: true,
              type: "line",
              snap: false,
              triggerTooltip: false,
              label: { show: false },
              lineStyle: { color: "#9ca3af", width: 1, type: "dashed" },
            } as any,
          },
          {
            gridIndex: 1,
            type: "value",
            min: 0,
            max: totalLength,
            show: false,
            axisPointer: {
              show: true,
              type: "line",
              snap: false,
              triggerTooltip: false,
              label: { show: false },
              lineStyle: { color: "#9ca3af", width: 1, type: "dashed" },
            } as any,
          },
        ],
        yAxis: [
          {
            type: "value",
            min: Math.round(yAxisRange.min),
            max: Math.round(yAxisRange.max),
            interval: Math.round(yAxisRange.interval),
            axisLabel: {
              fontSize: 12,
              formatter: (val: number) => localizeDecimal(val, { decimals: 0 }),
            },
          },
          {
            gridIndex: 1,
            type: "value",
            min: yAxisRange.min,
            max: yAxisRange.max,
            interval: yAxisRange.interval,
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: {
              fontSize: 12,
              color: "transparent",
              formatter: (val: number) => localizeDecimal(val, { decimals: 0 }),
            },
          },
        ],
        series: [
          ...((series ?? []) as any[]),
          ...((stripSeries ?? []) as any[]),
        ],
        tooltip: { show: false },
        axisPointer: {
          link: [{ xAxisIndex: [0, 1] }],
          triggerOn: "none",
        } as any,
        dataZoom: [
          {
            type: "inside",
            xAxisIndex: [0, 1],
            filterMode: "none",
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
            preventDefaultMouseMove: true,
            minValueSpan: 1,
          },
        ],
      })),
    [
      series,
      stripSeries,
      nodePositions,
      totalLength,
      yAxisRange,
      profileGridTop,
    ],
  );

  //eslint-disable-next-line no-console
  console.log(
    `DEBUG PROFILE_CHART:render points=${points.length} links=${links?.length ?? 0}`,
  );

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
        containerRef={containerRef}
        chartRef={chartRef}
        points={points}
        links={links}
        terrain={terrain}
        pressureFactor={pressureFactor}
        pathSegments={pathSegments}
        elevColor={nodeSymbology.defaults.color}
        translate={translate}
        setHoverHighlight={setHoverHighlight}
      />
    </div>
  );
});
