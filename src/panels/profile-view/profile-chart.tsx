"use client";
import { memo, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { ProfilePoint } from "./use-profile-data";
import { useTerrainElevations } from "./use-terrain-elevations";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";

interface ProfileChartProps {
  points: ProfilePoint[];
}

export const ProfileChart = memo(function ProfileChart({
  points,
}: ProfileChartProps) {
  const translate = useTranslate();

  const terrain = useTerrainElevations(points);
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
      terrain
        ? points.map((p, i) => [p.cumulativeLength, terrain[i] ?? 0])
        : null,
    [terrain, points],
  );

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
            smooth: true,
            silent: true,
            showInLegend: false,
            tooltip: { show: false },
          },
        ]
      : [];

    const base = [
      ...terrainSeries,
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

    return [
      ...base,
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
  }, [translate, elevationData, hglData, hasSimulation, terrainData]);

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
        bottom: 4,
        left: 8,
        containLabel: true,
      },
      legend: hasSimulation
        ? {
            show: true,
            top: 0,
            right: 0,
            itemWidth: 14,
            itemHeight: 8,
            textStyle: { fontSize: 11 },
          }
        : undefined,
      xAxis: {
        type: "value",
        min: 0,
        max: totalLength,
        name: translate("profileView.distance"),
        nameLocation: "middle",
        nameGap: 24,
        splitLine: { show: true, lineStyle: { color: "#e5e7eb" } },
        axisTick: { customValues: nodePositions } as any,
        axisLabel: {
          fontSize: 11,
          customValues: nodePositions,
          formatter: (val: number) => localizeDecimal(val, { decimals: 0 }),
        } as any,
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 11 },
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
            .filter((p: any) => p.seriesName !== "terrain")
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
    [series, points, nodePositions, totalLength, translate, hasSimulation],
  );

  return (
    <ReactECharts
      option={option}
      style={{ height: "100%", width: "100%" }}
      notMerge={true}
    />
  );
});
