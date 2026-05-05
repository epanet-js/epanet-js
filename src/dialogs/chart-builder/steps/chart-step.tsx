import { useEffect, useRef, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTranslate } from "src/hooks/use-translate";
import { colors } from "src/lib/constants";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { calculateInterval } from "src/panels/asset-panel/quick-graph/quick-graph-chart";
import {
  useChartData,
  computePercentileSeries,
  buildTimeLabels,
} from "./use-chart-data";
import type { AssetSeries } from "./use-chart-data";

const MAX_LINES = 12;

const CHART_COLORS = [
  "#A2780B",
  "#FF4939",
  "#21A344",
  "#3D77FF",
  "#1EA347",
  "#987C0C",
  "#FF4749",
  "#6169FF",
  "#00A2B5",
  "#6D8B15",
  "#D1660C",
  "#C14FD4",
];

const EMERALD_SCALE = [
  "#022c22", // 950
  "#064e3b", // 900
  "#065f46", // 800
  "#047857", // 700
  "#059669", // 600
  "#10b981", // 500
  "#34d399", // 400
  "#6ee7b7", // 300
  "#a7f3d0", // 200
  "#d1fae5", // 100
];

const ORANGE_SCALE = [
  "#431407", // 950
  "#7c2d12", // 900
  "#9a3412", // 800
  "#c2410c", // 700
  "#ea580c", // 600
  "#f97316", // 500
  "#fb923c", // 400
  "#fdba74", // 300
  "#fed7aa", // 200
  "#ffedd5", // 100
];

function buildXAxis(
  count: number,
  intervalSeconds: number,
): EChartsOption["xAxis"] {
  return {
    type: "category",
    data: buildTimeLabels(count, intervalSeconds),
    boundaryGap: false,
    splitLine: {
      show: true,
      lineStyle: { color: colors.gray300, type: "dashed" as const },
    },
    axisTick: { show: true, lineStyle: { color: colors.gray300 } },
    axisLabel: { color: colors.gray500, fontSize: 12 },
    axisLine: { show: true, lineStyle: { color: colors.gray300 } },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildYAxisConfig(values: number[], decimals: number, name = ""): any {
  const { min, max, interval } = calculateInterval(decimals, values, 5);
  return {
    type: "value",
    name,
    nameLocation: "end",
    nameTextStyle: { color: colors.gray500, fontSize: 11, align: "left" },
    min,
    max,
    interval,
    splitLine: {
      show: true,
      lineStyle: { color: colors.gray300, type: "dashed" },
    },
    axisLine: { show: true, lineStyle: { color: colors.gray300 } },
    axisTick: { show: true, lineStyle: { color: colors.gray300 } },
    axisLabel: {
      color: colors.gray500,
      fontSize: 12,
      formatter: (v: number) => localizeDecimal(v, { decimals }),
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildLineSeries(
  label: string,
  data: number[],
  color: string,
  yAxisIndex = 0,
  dashed = false,
): any {
  return {
    type: "line",
    name: label,
    data,
    yAxisIndex,
    lineStyle: {
      color,
      width: 2,
      ...(dashed ? { type: "dashed" as const } : {}),
    },
    itemStyle: { color },
    symbol: "none",
    smooth: false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPercentileSeries(
  percs: ReturnType<typeof computePercentileSeries>,
  baseColor: string,
  yAxisIndex = 0,
  dashed = false,
): any[] {
  return [
    {
      type: "line",
      name: "P10",
      data: percs.p10,
      yAxisIndex,
      lineStyle: { opacity: 0 },
      itemStyle: { color: baseColor },
      symbol: "none",
      stack: `band-outer-${yAxisIndex}`,
      silent: true,
    },
    {
      type: "line",
      name: "P10–P90",
      data: percs.p90.map((v, i) => v - percs.p10[i]),
      yAxisIndex,
      lineStyle: { opacity: 0 },
      itemStyle: { color: baseColor },
      areaStyle: { color: baseColor, opacity: 0.12 },
      symbol: "none",
      stack: `band-outer-${yAxisIndex}`,
      silent: true,
    },
    {
      type: "line",
      name: "P25",
      data: percs.p25,
      yAxisIndex,
      lineStyle: { opacity: 0 },
      itemStyle: { color: baseColor },
      symbol: "none",
      stack: `band-inner-${yAxisIndex}`,
      silent: true,
    },
    {
      type: "line",
      name: "P25–P75",
      data: percs.p75.map((v, i) => v - percs.p25[i]),
      yAxisIndex,
      lineStyle: { opacity: 0 },
      itemStyle: { color: baseColor },
      areaStyle: { color: baseColor, opacity: 0.28 },
      symbol: "none",
      stack: `band-inner-${yAxisIndex}`,
      silent: true,
    },
    {
      type: "line",
      name: "Median (P50)",
      data: percs.p50,
      yAxisIndex,
      lineStyle: {
        color: baseColor,
        width: 2,
        ...(dashed ? { type: "dashed" as const } : {}),
      },
      itemStyle: { color: baseColor },
      symbol: "none",
      smooth: false,
    },
  ];
}

interface ChartStepProps {
  selectedAssetIds: number[];
  nodeProperty: string | null;
  linkProperty: string | null;
}

export function ChartStep({
  selectedAssetIds,
  nodeProperty,
  linkProperty,
}: ChartStepProps) {
  const translate = useTranslate();
  const {
    isLoading,
    hasSimulation,
    timestepCount,
    intervalSeconds,
    nodeSeries,
    linkSeries,
    allNodeValues,
    allLinkValues,
    nodeDecimals,
    linkDecimals,
    nodeAxisLabel,
    linkAxisLabel,
    isMixed,
  } = useChartData(selectedAssetIds, nodeProperty, linkProperty);

  const option: EChartsOption = useMemo(() => {
    if (timestepCount === 0) return {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series: any[] = [];

    const buildGroup = (
      group: AssetSeries[],
      yAxisIndex: number,
      colorScale: string[],
      dashed = false,
    ) => {
      if (group.length === 0) return;
      const valid = group.filter((s) => s.timeSeries);
      if (valid.length === 0) return;

      if (valid.length <= MAX_LINES) {
        valid.forEach((s, i) => {
          series.push(
            buildLineSeries(
              s.label,
              Array.from(s.timeSeries!.values),
              colorScale[i % colorScale.length] ?? colorScale[0],
              yAxisIndex,
              dashed,
            ),
          );
        });
      } else {
        const percs = computePercentileSeries(
          valid.map((s) => s.timeSeries!.values),
          timestepCount,
        );
        series.push(
          ...buildPercentileSeries(percs, colorScale[0], yAxisIndex, dashed),
        );
      }
    };

    buildGroup(nodeSeries, 0, isMixed ? EMERALD_SCALE : CHART_COLORS);
    buildGroup(
      linkSeries,
      isMixed ? 1 : 0,
      isMixed ? ORANGE_SCALE : CHART_COLORS,
      isMixed,
    );

    const yAxisLeft = buildYAxisConfig(
      isMixed ? allNodeValues : [...allNodeValues, ...allLinkValues],
      isMixed
        ? nodeDecimals
        : nodeSeries.length > 0
          ? nodeDecimals
          : linkDecimals,
      isMixed
        ? nodeAxisLabel
        : nodeSeries.length > 0
          ? nodeAxisLabel
          : linkAxisLabel,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yAxis: any = isMixed
      ? [
          { ...yAxisLeft, position: "left" },
          {
            ...buildYAxisConfig(allLinkValues, linkDecimals, linkAxisLabel),
            position: "right",
            alignTicks: true,
            splitLine: { show: false },
          },
        ]
      : { ...yAxisLeft };

    return {
      animation: false,
      grid: { top: 28, right: 16, bottom: 36, left: 16, containLabel: true },
      legend: {
        show: true,
        bottom: 0,
        left: "center",
        itemWidth: 16,
        itemHeight: 8,
        textStyle: { fontSize: 11, color: colors.gray600 },
      },
      xAxis: buildXAxis(timestepCount, intervalSeconds),
      yAxis,
      series,
      tooltip: {
        trigger: "axis",
        appendToBody: true,
        backgroundColor: "white",
        borderColor: colors.gray300,
        textStyle: { color: colors.gray700, fontSize: 13 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const timeLabel = params[0]?.name ?? "";
          const lines = params
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter(
              (p: any) =>
                !["P10", "P25", "P10–P90", "P25–P75"].includes(p.seriesName),
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((p: any) => {
              const dec =
                p.seriesIndex < nodeSeries.length ? nodeDecimals : linkDecimals;
              const dot = `<span style="display:inline-block;width:8px;height:8px;background:${p.color};margin-right:4px;border-radius:50%;"></span>`;
              return `${dot}${p.seriesName}: ${localizeDecimal(p.value, { decimals: dec })}`;
            });
          return `${timeLabel}<br/>${lines.join("<br/>")}`;
        },
      },
    };
  }, [
    timestepCount,
    intervalSeconds,
    nodeSeries,
    linkSeries,
    allNodeValues,
    allLinkValues,
    nodeDecimals,
    linkDecimals,
    nodeAxisLabel,
    linkAxisLabel,
    isMixed,
  ]);

  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance()?.resize();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  if (!hasSimulation) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        {translate("chartBuilder.label")}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!isLoading && timestepCount === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          No data available
        </div>
      ) : (
        <div className="absolute inset-0">
          <ReactECharts
            ref={chartRef}
            option={option}
            style={{ height: "100%", width: "100%" }}
            opts={{ renderer: "svg" }}
          />
        </div>
      )}
    </div>
  );
}
