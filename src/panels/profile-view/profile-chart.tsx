"use client";
import { memo, useCallback, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useSetAtom } from "jotai";
import { ProfilePoint, useTerrainSamples } from "./use-profile-data";
import { HglRange } from "./use-profile-hgl-range";
import { useTerrainElevations } from "./use-terrain-elevations";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { selectionAtom } from "src/state/selection";
import { tabAtom, TabOption } from "src/state/layout";
import { USelection } from "src/selection/selection";

interface ProfileChartProps {
  points: ProfilePoint[];
  hglRanges: (HglRange | null)[] | null;
}

export const ProfileChart = memo(function ProfileChart({
  points,
  hglRanges,
}: ProfileChartProps) {
  const translate = useTranslate();
  const setSelection = useSetAtom(selectionAtom);
  const setTab = useSetAtom(tabAtom);

  const onChartClick = useCallback(
    (params: any) => {
      const point = points[params?.dataIndex];
      if (!point) return;
      setSelection(USelection.single(point.nodeId));
      setTab(TabOption.Asset);
    },
    [points, setSelection, setTab],
  );

  const terrainSamples = useTerrainSamples();
  const terrain = useTerrainElevations(terrainSamples);
  const hasSimulation = points.some(
    (p) => p.head !== null || p.pressure !== null,
  );

  const elevationData = useMemo(
    () => points.map((p) => [p.cumulativeLength, p.elevation]),
    [points],
  );
  const hglData = useMemo(
    () => points.map((p) => [p.cumulativeLength, p.head]),
    [points],
  );
  const terrainData = useMemo(
    () =>
      terrain ? terrain.map((t) => [t.cumulativeLength, t.elevation]) : null,
    [terrain],
  );

  // Group contiguous nodes that have valid min/max head into segments,
  // each rendered as a single polygon by the custom band series.
  const hglBandSegments = useMemo(() => {
    if (!hglRanges || hglRanges.length !== points.length) return null;
    const segments: Array<Array<{ x: number; min: number; max: number }>> = [];
    let current: Array<{ x: number; min: number; max: number }> | null = null;
    for (let i = 0; i < points.length; i++) {
      const r = hglRanges[i];
      if (r) {
        if (!current) current = [];
        current.push({
          x: points[i].cumulativeLength,
          min: r.minHead,
          max: r.maxHead,
        });
      } else {
        if (current && current.length >= 2) segments.push(current);
        current = null;
      }
    }
    if (current && current.length >= 2) segments.push(current);
    return segments.length > 0 ? segments : null;
  }, [points, hglRanges]);

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

  // Blue vertical drops: HGL down to node elevation
  const hglDropsData = useMemo(() => {
    if (!hasSimulation) return [];
    const result: (number[] | null)[] = [];
    points.forEach((p) => {
      if (p.head !== null) {
        result.push([p.cumulativeLength, p.head]);
        result.push([p.cumulativeLength, p.elevation]);
        result.push(null);
      }
    });
    return result;
  }, [points, hasSimulation]);

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
      lineStyle: { color: "#c8a96e", width: 1 },
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
        lineStyle: { color: "#92400e", width: 2 },
        itemStyle: { color: "#92400e" },
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
      lineStyle: { color: "#2563eb", width: 2 },
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
        symbolSize: 5,
        smooth: false,
      },
    ];
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

  const nodePositions = useMemo(
    () => points.map((p) => p.cumulativeLength),
    [points],
  );

  const totalLength = nodePositions[nodePositions.length - 1] ?? 0;

  const option: EChartsOption = useMemo(
    () => ({
      animation: false,
      grid: {
        top: hasSimulation ? 24 : 8,
        right: 12,
        bottom: 12, // Increased bottom margin to accommodate rotated labels
        left: 12,
        containLabel: true,
      },
      xAxis: {
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
      },
      yAxis: {
        type: "value",
        min: Math.round(yAxisRange.min),
        max: Math.round(yAxisRange.max),
        interval: Math.round(yAxisRange.interval),
        axisLabel: {
          fontSize: 12,
          formatter: (val: number) => localizeDecimal(val, { decimals: 0 }),
        },
      },
      series,
      tooltip: {
        trigger: "axis",
        appendToBody: true,
        backgroundColor: "white",
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const idx = params[0]?.dataIndex ?? 0;
          const point = points[idx];
          const label = point?.label ?? "";
          const lines = params
            .filter(
              (p: any) =>
                p.seriesName !== "terrain" &&
                p.seriesName !== "elevDrops" &&
                p.seriesName !== "hglDrops" &&
                p.seriesName !== "hglBandBase" &&
                p.seriesName !== "hglBand",
            )
            .map((p: any) => {
              const dot = `<span style="display:inline-block;width:8px;height:8px;background:${p.color};margin-right:4px;border-radius:50%;"></span>`;
              const raw = Array.isArray(p.value) ? p.value[1] : p.value;
              const val =
                raw !== null && raw !== undefined
                  ? localizeDecimal(raw as number, { decimals: 2 })
                  : "—";
              return `${dot}${p.seriesName ?? ""}: ${val}`;
            });
          return `<strong>${label}</strong><br/>${lines.join("<br/>")}`;
        },
      },
    }),
    [
      series,
      points,
      nodePositions,
      totalLength,
      translate,
      hasSimulation,
      yAxisRange,
    ],
  );

  return (
    <ReactECharts
      option={option}
      style={{ height: "100%", width: "100%" }}
      notMerge={true}
      onEvents={{ click: onChartClick }}
    />
  );
});
