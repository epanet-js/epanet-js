"use client";
import { useEffect, useRef, useMemo, memo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { colors } from "src/lib/constants";
import { CustomGraphChartProps, GraphDefaultOptions } from ".";
import {
  buildTimeLabels,
  calculateXAxisInterval,
  calculateXAxisStep,
  calculateInterval,
} from "./chart-helpers";

interface CombinedChartProps {
  seriesData: CustomGraphChartProps["seriesData"];
  nodeCount: number;
  nodeYAxisLabel: string;
  linkYAxisLabel: string;
  nodeDecimals: number;
  linkDecimals: number;
  unitLabels: string[];
  linkValueFormatter?: (value: number) => string;
}

export const CombinedChart = memo(function CombinedChart({
  seriesData,
  nodeCount,
  nodeYAxisLabel,
  linkYAxisLabel,
  nodeDecimals,
  linkDecimals,
  unitLabels,
  linkValueFormatter,
}: CombinedChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasBothAxes = nodeCount > 0 && nodeCount < seriesData.length;

  const firstSeries = seriesData[0]?.timeSeries;
  const intervalsCount = firstSeries?.intervalsCount ?? 0;
  const intervalSeconds = firstSeries?.intervalSeconds ?? 0;

  const nodeValues = useMemo(
    () =>
      seriesData
        .slice(0, nodeCount)
        .flatMap((s) => Array.from(s.timeSeries.values)),
    [seriesData, nodeCount],
  );
  const linkValues = useMemo(
    () =>
      seriesData
        .slice(nodeCount)
        .flatMap((s) => Array.from(s.timeSeries.values)),
    [seriesData, nodeCount],
  );

  const xAxisInterval = useMemo(
    () => calculateXAxisInterval(intervalsCount, intervalSeconds),
    [intervalsCount, intervalSeconds],
  );
  const xAxisStep = useMemo(
    () => calculateXAxisStep(intervalsCount, intervalSeconds),
    [intervalsCount, intervalSeconds],
  );

  const xAxis: EChartsOption["xAxis"] = useMemo(
    () => ({
      type: "category",
      data: buildTimeLabels(intervalsCount, intervalSeconds),
      show: true,
      boundaryGap: false,
      splitLine: {
        show: true,
        lineStyle: { color: colors.gray300, type: "dashed" },
        interval: (index: number) => {
          if (index === intervalsCount - 1) return false;
          return index % xAxisStep === 0;
        },
      },
      axisTick: {
        show: true,
        alignWithLabel: true,
        lineStyle: { color: colors.gray300 },
        interval: (index: number) => index % xAxisStep === 0,
      },
      axisLabel: {
        show: true,
        interval: xAxisInterval,
        color: colors.gray500,
        fontSize: 12,
        hideOverlap: true,
      },
      axisLine: { show: true, lineStyle: { color: colors.gray300 } },
    }),
    [intervalsCount, intervalSeconds, xAxisStep, xAxisInterval],
  );

  const yAxis: EChartsOption["yAxis"] = useMemo(() => {
    const buildYAxis = (
      label: string,
      decimals: number,
      values: number[],
      position: "left" | "right",
      showSplitLine: boolean,
      formatter?: (value: number) => string,
    ) => {
      const { min, max, interval } = formatter
        ? { min: 0, max: 1, interval: 1 }
        : calculateInterval(decimals, values, 5);
      return {
        type: "value" as const,
        scale: true,
        position,
        name: label,
        nameLocation: "middle" as const,
        nameGap: 50,
        nameTextStyle: { color: colors.gray500, fontSize: 13 },
        min,
        max,
        interval,
        splitLine: {
          show: showSplitLine,
          lineStyle: { color: colors.gray300, type: "dashed" as const },
        },
        axisLine: { show: true, lineStyle: { color: colors.gray300 } },
        axisTick: { show: true, lineStyle: { color: colors.gray300 } },
        axisLabel: {
          color: colors.gray500,
          fontSize: 12,
          formatter: formatter
            ? (value: number) => formatter(value)
            : (value: number) => localizeDecimal(value),
        },
      };
    };

    if (hasBothAxes) {
      return [
        buildYAxis(
          linkYAxisLabel,
          linkDecimals,
          linkValues,
          "left",
          true,
          linkValueFormatter,
        ),
        buildYAxis(nodeYAxisLabel, nodeDecimals, nodeValues, "right", false),
      ];
    }

    const isNodeOnly = nodeCount > 0;
    return buildYAxis(
      isNodeOnly ? nodeYAxisLabel : linkYAxisLabel,
      isNodeOnly ? nodeDecimals : linkDecimals,
      isNodeOnly ? nodeValues : linkValues,
      "left",
      true,
      isNodeOnly ? undefined : linkValueFormatter,
    );
  }, [
    hasBothAxes,
    nodeCount,
    nodeValues,
    linkValues,
    nodeDecimals,
    linkDecimals,
    nodeYAxisLabel,
    linkYAxisLabel,
    linkValueFormatter,
  ]);

  const series: EChartsOption["series"] = useMemo(
    () =>
      seriesData.map((s, i) => {
        const color =
          GraphDefaultOptions.SERIES_COLORS[
            i % GraphDefaultOptions.SERIES_COLORS.length
          ];
        const isNode = i < nodeCount;
        return {
          type: "line" as const,
          name: s.label,
          data: Array.from(s.timeSeries.values),
          lineStyle: { color, width: 2 },
          itemStyle: { color },
          symbol: "none",
          smooth: false,
          ...(hasBothAxes ? { yAxisIndex: isNode ? 1 : 0 } : {}),
          ...(!isNode && linkValueFormatter ? { step: "end" as const } : {}),
        };
      }),
    [seriesData, nodeCount, hasBothAxes, linkValueFormatter],
  );

  const option: EChartsOption = useMemo(
    () => ({
      animation: false,
      grid: {
        top: 8,
        right: 40,
        bottom: 32,
        left: 40,
        containLabel: true,
      },
      legend: {
        show: true,
        bottom: 0,
        left: "center",
        itemWidth: 16,
        itemHeight: 8,
        textStyle: { fontSize: 12, color: colors.gray600 },
        data:
          seriesData.length > GraphDefaultOptions.MAX_VISIBLE_LEGENDS
            ? [
                ...seriesData
                  .slice(0, GraphDefaultOptions.MAX_VISIBLE_LEGENDS)
                  .map((s) => s.label),
                `...other ${seriesData.length - GraphDefaultOptions.MAX_VISIBLE_LEGENDS} assets`,
              ]
            : undefined,
        formatter: (name: string) => name,
      },
      xAxis,
      yAxis,
      series,
      tooltip: {
        trigger: "axis",
        appendToBody: true,
        backgroundColor: "white",
        borderColor: colors.gray300,
        textStyle: { color: colors.gray700, fontSize: 14 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const timeLabel = params[0]?.name ?? "";
          const visible = params.slice(
            0,
            GraphDefaultOptions.MAX_VISIBLE_LEGENDS,
          );
          const remaining =
            params.length - GraphDefaultOptions.MAX_VISIBLE_LEGENDS;
          const rows = visible.map(
            (
              p: {
                color: string;
                seriesName?: string;
                seriesIndex?: number;
                value: number;
              },
              i: number,
            ) => {
              const idx = p.seriesIndex ?? i;
              const isLink = idx >= nodeCount;
              const displayValue =
                isLink && linkValueFormatter
                  ? linkValueFormatter(p.value)
                  : p.value.toFixed(GraphDefaultOptions.TOOLTIP_DECIMALS);
              const unit = unitLabels[idx] ?? "";
              const assetType = isLink ? "link" : "node";
              const colorDot = `<span style="display:inline-block;width:8px;height:8px;background:${p.color};margin-right:4px;border-radius:50%;vertical-align:middle;"></span>`;
              return (
                `<tr>` +
                `<td>${colorDot}${p.seriesName ?? ""} <span style="color:${colors.gray400}">(${assetType})</span></td>` +
                `<td style="font-variant-numeric:tabular-nums;text-align:right;padding-left:16px;">${displayValue}</td>` +
                `<td style="padding-left:4px;">${unit}</td>` +
                `</tr>`
              );
            },
          );
          let footer = "";
          if (remaining > 0) {
            footer = `<tr><td colspan="3" style="color:${colors.gray500};font-size:12px;">...other ${remaining} assets</td></tr>`;
          }
          return `${timeLabel}<table style="border-spacing:0;">${rows.join("")}${footer}</table>`;
        },
      },
    }),
    [
      seriesData,
      xAxis,
      yAxis,
      series,
      unitLabels,
      nodeCount,
      linkValueFormatter,
    ],
  );

  useEffect(function resizeChart() {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance()?.resize();
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  if (intervalsCount === 0 || seriesData.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <ReactECharts
        ref={chartRef}
        key={`${intervalSeconds}-${intervalsCount}`}
        option={option}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
});
