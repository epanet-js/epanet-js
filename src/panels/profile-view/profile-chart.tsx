"use client";
import { memo, useCallback, useMemo, useRef } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption, SeriesOption } from "echarts";
import { useSetAtom } from "jotai";
import { ProfileViewData } from "./chart-data";
import {
  buildProfileChartOption,
  elevationDropsPlot,
  elevationLinePlot,
  hglBandPlot,
  hglDropsPlot,
  hglLinePlot,
  junctionsStripPlot,
  nodesHitStripPlot,
  pipesStripPlot,
  profileGridTopOffset,
  pumpValvesStripPlot,
  pumpsStripPlot,
  reservoirsStripPlot,
  tanksStripPlot,
  terrainAreaPlot,
  valvesStripPlot,
} from "./plots";
import { useStripPlanIcons } from "./use-strip-plan-icons";
import { useTranslate } from "src/hooks/use-translate";
import { selectionAtom } from "src/state/selection";
import { tabAtom, TabOption } from "src/state/layout";
import { linkSymbologyAtom, nodeSymbologyAtom } from "src/state/map-symbology";
import { highlightsAtom } from "src/state/highlights";
import { traceDuration } from "src/infra/with-instrumentation";
import { isDebugOn } from "src/infra/debug-mode";
import { useAtomValue } from "jotai";
import { USelection } from "src/selection/selection";
import { ProfileTooltip } from "./profile-tooltip";
import { useChartCursor } from "./use-chart-cursor";

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
        nodesHitStripPlot(points, stripY),
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

  const profileGridTop = profileGridTopOffset(hasSimulation);

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

  const option: EChartsOption = useMemo(
    () =>
      traceDuration("DEBUG PROFILE_CHART:option", () =>
        buildProfileChartOption({
          series: [
            ...(series ?? []),
            ...((stripSeries ?? []) as SeriesOption[]),
          ],
          xTickPositions: nodePositions,
          xMax: totalLength,
          yMin: yAxisRange.min,
          yMax: yAxisRange.max,
          yInterval: yAxisRange.interval,
          profileGridTop,
        }),
      ),
    [
      series,
      stripSeries,
      nodePositions,
      totalLength,
      yAxisRange,
      profileGridTop,
    ],
  );

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
        elevColor={nodeSymbology.defaults.color}
        translate={translate}
      />
    </div>
  );
});
