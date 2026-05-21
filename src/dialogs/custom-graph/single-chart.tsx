"use client";
import {
  useEffect,
  useRef,
  useMemo,
  memo,
  forwardRef,
  useImperativeHandle,
} from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { colors } from "src/lib/constants";
import { SingleGraphChartProps, GraphDefaultOptions } from ".";
import {
  buildTimeLabels,
  calculateXAxisInterval,
  calculateXAxisStep,
  calculateInterval,
} from "./chart-helpers";

interface SingleChartInternalProps extends SingleGraphChartProps {
  onAxisPointer?: (params: { dataIndex?: number }) => void;
  onMouseOut?: () => void;
}

export const SingleChart = memo(
  forwardRef<ReactECharts, SingleChartInternalProps>(function SingleChart(
    {
      seriesData,
      yAxisLabel,
      decimals,
      unitLabel,
      showXAxisLabels,
      onAxisPointer,
      onMouseOut,
      valueFormatter,
    },
    ref,
  ) {
    const translate = useTranslate();
    const chartRef = useRef<ReactECharts>(null);
    useImperativeHandle(ref, () => chartRef.current!, []);
    const containerRef = useRef<HTMLDivElement>(null);
    const hideLegend =
      seriesData.length > GraphDefaultOptions.MAX_VISIBLE_LEGENDS;

    const firstSeries = seriesData[0]?.timeSeries;
    const intervalsCount = firstSeries?.intervalsCount ?? 0;
    const intervalSeconds = firstSeries?.intervalSeconds ?? 0;

    const allValues = useMemo(
      () => seriesData.flatMap((s) => Array.from(s.timeSeries.values)),
      [seriesData],
    );

    const xAxisInterval = useMemo(
      () => calculateXAxisInterval(intervalsCount, intervalSeconds),
      [intervalsCount, intervalSeconds],
    );
    const xAxisStep = useMemo(
      () => calculateXAxisStep(intervalsCount, intervalSeconds),
      [intervalsCount, intervalSeconds],
    );

    const option: EChartsOption = useMemo(() => {
      const { min, max, interval } = valueFormatter
        ? { min: 0, max: 1, interval: 1 }
        : calculateInterval(decimals, allValues, 5);

      return {
        animation: false,
        grid: {
          top: 8,
          right: 40,
          bottom: showXAxisLabels ? 32 : 8,
          left: 40,
          containLabel: true,
        },
        legend: {
          show: seriesData.length <= GraphDefaultOptions.MAX_VISIBLE_LEGENDS,
          bottom: 0,
          left: "center",
          itemWidth: 16,
          itemHeight: 8,
          textStyle: { fontSize: 12, color: colors.gray600 },
          formatter: (name: string) => name,
        },
        xAxis: {
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
            show: showXAxisLabels,
            interval: xAxisInterval,
            color: colors.gray500,
            fontSize: 12,
            hideOverlap: true,
          },
          axisLine: { show: true, lineStyle: { color: colors.gray300 } },
        },
        yAxis: {
          type: "value",
          scale: true,
          position: "left",
          name: yAxisLabel,
          nameLocation: "middle",
          nameGap: 50,
          nameTextStyle: { color: colors.gray500, fontSize: 13 },
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
            formatter: valueFormatter
              ? (value: number) => valueFormatter(value)
              : (value: number) => localizeDecimal(value),
          },
        },
        series: seriesData.map((s, i) => {
          const color =
            GraphDefaultOptions.SERIES_COLORS[
              i % GraphDefaultOptions.SERIES_COLORS.length
            ];
          return {
            type: "line" as const,
            name: s.label,
            data: Array.from(s.timeSeries.values),
            lineStyle: { color, width: 2 },
            itemStyle: { color },
            symbol: "none",
            smooth: false,
            step: valueFormatter ? ("end" as const) : undefined,
          };
        }),
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
              (p: { color: string; seriesName?: string; value: number }) => {
                const displayValue = valueFormatter
                  ? valueFormatter(p.value)
                  : p.value.toFixed(GraphDefaultOptions.TOOLTIP_DECIMALS);
                const colorDot = `<span style="display:inline-block;width:8px;height:8px;background:${p.color};margin-right:4px;border-radius:50%;vertical-align:middle;"></span>`;
                return (
                  `<tr>` +
                  `<td>${colorDot}${p.seriesName ?? ""}</td>` +
                  `<td style="font-variant-numeric:tabular-nums;text-align:right;padding-left:16px;">${displayValue}</td>` +
                  `<td style="padding-left:4px;">${unitLabel}</td>` +
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
      };
    }, [
      seriesData,
      allValues,
      decimals,
      yAxisLabel,
      unitLabel,
      intervalsCount,
      intervalSeconds,
      xAxisStep,
      xAxisInterval,
      showXAxisLabels,
      valueFormatter,
    ]);

    useEffect(function resizeChart() {
      const container = containerRef.current;
      if (!container) return;
      const resizeObserver = new ResizeObserver(() => {
        chartRef.current?.getEchartsInstance()?.resize();
      });
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
      const instance = chartRef.current?.getEchartsInstance();
      if (!instance || !onAxisPointer) return;

      const handler = (params: unknown) => {
        const p = params as {
          currentIndex?: number;
          seriesIndex?: number;
          dataIndex?: number;
        };
        const dataIndex = p.currentIndex ?? p.dataIndex;
        if (dataIndex !== undefined) onAxisPointer({ dataIndex });
      };

      instance.on("updateAxisPointer", handler);
      return () => {
        instance.off("updateAxisPointer", handler);
      };
    }, [onAxisPointer]);

    if (intervalsCount === 0 || seriesData.length === 0) {
      return null;
    }

    return (
      <div
        ref={containerRef}
        className="flex flex-col h-full w-full"
        onMouseLeave={onMouseOut}
      >
        <div className="flex-1 min-h-0">
          <ReactECharts
            ref={chartRef}
            key={`${intervalSeconds}-${intervalsCount}`}
            option={option}
            style={{ height: "100%", width: "100%" }}
            opts={{ renderer: "svg" }}
          />
        </div>
        {hideLegend && showXAxisLabels && (
          <p className="text-center text-xs italic text-gray-400 pb-1">
            {translate("customGraph.legendHidden")}
          </p>
        )}
      </div>
    );
  }),
);
