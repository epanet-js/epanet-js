"use client";
import { memo, useCallback, useMemo, useRef } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useSetAtom } from "jotai";
import { ProfileLink, ProfileViewData } from "./chart-data";
import { useStripPlanIcons } from "./use-strip-plan-icons";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { selectionAtom } from "src/state/selection";
import { tabAtom, TabOption } from "src/state/layout";
import { linkSymbologyAtom, nodeSymbologyAtom } from "src/state/map-symbology";
import { highlightsAtom } from "src/state/highlights";
import { traceDuration } from "src/infra/with-instrumentation";
import { useAtomValue } from "jotai";
import { colors } from "src/lib/constants";
import { USelection } from "src/selection/selection";
import { ProfileTooltip } from "./profile-tooltip";

const STRIP_GRID_TOP = 6;
const STRIP_GRID_HEIGHT = 30;
const STRIP_PROFILE_GAP = 2;

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
    const result: (number[] | null)[] = [];
    points.forEach((p) => {
      result.push([p.cumulativeLength, p.elevation]);
      result.push([p.cumulativeLength, yAxisRange.min]);
      result.push(null);
    });
    return result;
  }, [points, yAxisRange.min]);

  const series: EChartsOption["series"] = useMemo(() => {
    return traceDuration("DEBUG PROFILE_CHART:series", () => {
      const terrainSeries = terrainData
        ? [
            {
              type: "line" as const,
              name: "terrain",
              data: terrainData,
              lineStyle: { opacity: 0, width: 0 },
              itemStyle: { opacity: 0 },
              areaStyle: { color: "#c8a96e", opacity: 0.22 },
              symbol: "none",
              smooth: false,
              silent: true,
              showInLegend: false,
              tooltip: { show: false },
            },
          ]
        : [];

      const hglBandSeries = hglBandSegments
        ? [
            {
              type: "custom" as const,
              name: "hglBand",
              data: hglBandSegments,
              silent: true,
              showInLegend: false,
              tooltip: { show: false },
              z: 1,
              /* eslint-disable @typescript-eslint/no-explicit-any,
               @typescript-eslint/no-unsafe-assignment,
               @typescript-eslint/no-unsafe-call,
               @typescript-eslint/no-unsafe-member-access */
              renderItem: (params: any, api: any) => {
                const segment = hglBandSegments[params.dataIndex];
                if (!segment || segment.length < 2) return null;
                const polygon: number[][] = [];
                for (let i = 0; i < segment.length; i++) {
                  polygon.push(api.coord([segment[i].x, segment[i].max]));
                }
                for (let i = segment.length - 1; i >= 0; i--) {
                  polygon.push(api.coord([segment[i].x, segment[i].min]));
                }
                return {
                  type: "polygon" as const,
                  shape: { points: polygon },
                  style: { fill: "#2563eb", opacity: 0.12 },
                  silent: true,
                };
              },
              /* eslint-enable */
            },
          ]
        : [];

      const elevDropsSeries = {
        type: "line" as const,
        name: "elevDrops",
        data: elevDropsData,
        lineStyle: { color: "#ada9a0", width: 1 },
        itemStyle: { opacity: 0 },
        symbol: "none",
        connectNulls: false,
        silent: true,
        showInLegend: false,
        tooltip: { show: false },
      };

      const base = [
        ...terrainSeries,
        ...hglBandSeries,
        elevDropsSeries,
        {
          type: "line" as const,
          name: translate("profileView.elevation"),
          data: elevationData,
          lineStyle: { color: linkSymbology.defaults.color, width: 1.75 },
          itemStyle: {
            color: nodeSymbology.defaults.color,
            borderColor: "#98abeb",
            borderWidth: 0.75,
          },
          symbol: "circle",
          symbolSize: 5,
          smooth: false,
        },
      ];

      if (!hasSimulation) return base;

      const hglDropsSeries = {
        type: "line" as const,
        name: "hglDrops",
        data: hglDropsData,
        lineStyle: { color: "#2563eb", width: 1.25 },
        itemStyle: { opacity: 0 },
        symbol: "none",
        connectNulls: false,
        silent: true,
        showInLegend: false,
        tooltip: { show: false },
      };

      return [
        ...base,
        hglDropsSeries,
        {
          type: "line" as const,
          name: translate("profileView.hgl"),
          data: hglData,
          lineStyle: { color: "#2563eb", width: 2 },
          itemStyle: { color: "#2563eb" },
          symbol: "circle",
          symbolSize: 0,
          smooth: false,
        },
      ];
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
  ]);

  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onChartReady = useCallback((chart: any) => {
    chartRef.current = chart;
  }, []);

  const stripY = (yAxisRange.min + yAxisRange.max) / 2;

  const stripSeries = useMemo<EChartsOption["series"]>(() => {
    return traceDuration("DEBUG PROFILE_CHART:stripSeries", () => {
      if (!links || links.length === 0) return [];

      const pipes = links.filter((l) => l.type === "pipe");
      const pumpValves = links.filter(
        (l) => l.type === "pump" || l.type === "valve",
      );

      const buildSegmentData = (segments: ProfileLink[]) => {
        const data: any[] = [];
        for (const seg of segments) {
          data.push({
            value: [seg.startLength, stripY],
            linkId: seg.linkId,
          });
          data.push({
            value: [seg.endLength, stripY],
            linkId: seg.linkId,
          });
          data.push(null);
        }
        return data;
      };

      const pipeColor = linkSymbology.defaults.color;
      const linkActiveColor = colors.orange700;

      const series: any[] = [];

      if (pipes.length > 0) {
        series.push({
          type: "line" as const,
          name: "stripPipes",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: buildSegmentData(pipes),
          lineStyle: { color: pipeColor, width: 3 },
          itemStyle: { color: pipeColor },
          symbol: "circle",
          symbolSize: 6,
          connectNulls: false,
          showInLegend: false,
          tooltip: { show: false },
          z: 2,
        });
      }

      if (pumpValves.length > 0) {
        series.push({
          type: "line" as const,
          name: "stripPumpValves",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: buildSegmentData(pumpValves),
          lineStyle: { color: linkActiveColor, width: 3 },
          itemStyle: { color: linkActiveColor },
          symbol: "circle",
          symbolSize: 6,
          connectNulls: false,
          showInLegend: false,
          tooltip: { show: false },
          z: 2,
        });
      }

      const junctions = points.filter((p) => p.nodeType === "junction");
      if (junctions.length > 0) {
        series.push({
          type: "scatter" as const,
          name: "stripNodes",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: junctions.map((j) => ({
            value: [j.cumulativeLength, stripY],
            nodeId: j.nodeId,
          })),
          symbol: "circle",
          symbolSize: 7,
          itemStyle: {
            color: nodeSymbology.defaults.color,
            borderColor: "#98abeb",
            borderWidth: 1,
            opacity: 1,
          },
          showInLegend: false,
          tooltip: { show: false },
          z: 5,
        });
      }

      const tanks = points.filter((p) => p.nodeType === "tank");
      if (tanks.length > 0) {
        const tankUrl = stripIcons.iconUrl("tank");
        series.push({
          type: "scatter" as const,
          name: "stripNodes",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: tanks.map((t) => ({
            value: [t.cumulativeLength, stripY],
            nodeId: t.nodeId,
            symbol: tankUrl ? `image://${tankUrl}` : "rect",
          })),
          symbolSize: 18,
          itemStyle: { opacity: 1 },
          showInLegend: false,
          tooltip: { show: false },
          z: 5,
        });
      }

      const reservoirs = points.filter((p) => p.nodeType === "reservoir");
      if (reservoirs.length > 0) {
        const reservoirUrl = stripIcons.iconUrl("reservoir");
        series.push({
          type: "scatter" as const,
          name: "stripNodes",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: reservoirs.map((r) => ({
            value: [r.cumulativeLength, stripY],
            nodeId: r.nodeId,
            symbol: reservoirUrl ? `image://${reservoirUrl}` : "diamond",
          })),
          symbolSize: 18,
          itemStyle: { opacity: 1 },
          showInLegend: false,
          tooltip: { show: false },
          z: 5,
        });
      }

      const pumps = links.filter((l) => l.type === "pump");
      if (pumps.length > 0) {
        series.push({
          type: "scatter" as const,
          name: "stripPumpIcons",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: pumps.map((p) => ({
            value: [p.midLength, stripY],
            linkId: p.linkId,
            symbol:
              stripIcons.pumpUrl(p) !== null
                ? `image://${stripIcons.pumpUrl(p)}`
                : "circle",
            symbolRotate: p.reversed ? 90 : -90,
          })),
          symbolSize: 18,
          itemStyle: { opacity: 1 },
          showInLegend: false,
          tooltip: { show: false },
          z: 10,
        });
      }

      const valves = links.filter((l) => l.type === "valve");
      if (valves.length > 0) {
        series.push({
          type: "scatter" as const,
          name: "stripValveIcons",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: valves.map((v) => ({
            value: [v.midLength, stripY],
            linkId: v.linkId,
            symbol:
              stripIcons.valveUrl(v) !== null
                ? `image://${stripIcons.valveUrl(v)}`
                : "circle",
            symbolRotate: v.reversed ? 90 : -90,
          })),
          symbolSize: 18,
          itemStyle: { opacity: 1 },
          showInLegend: false,
          tooltip: { show: false },
          z: 10,
        });
      }

      return series;
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
