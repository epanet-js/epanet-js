"use client";
import {
  useEffect,
  useRef,
  useMemo,
  memo,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { colors } from "src/lib/constants";
import {
  CustomGraphChartProps,
  SingleGraphChartProps,
  GraphDefaultOptions,
} from ".";

export const CustomGraphChart = memo(function CustomGraphChart({
  seriesData,
  nodeCount,
  nodeYAxisLabel,
  linkYAxisLabel,
  nodeDecimals,
  linkDecimals,
  unitLabels,
  combineAxes,
}: CustomGraphChartProps) {
  const hasBothTypes = nodeCount > 0 && nodeCount < seriesData.length;

  if (!hasBothTypes || combineAxes) {
    return (
      <CombinedChart
        seriesData={seriesData}
        nodeCount={nodeCount}
        nodeYAxisLabel={nodeYAxisLabel}
        linkYAxisLabel={linkYAxisLabel}
        nodeDecimals={nodeDecimals}
        linkDecimals={linkDecimals}
        unitLabels={unitLabels}
      />
    );
  }

  return (
    <SplitCharts
      seriesData={seriesData}
      nodeCount={nodeCount}
      nodeYAxisLabel={nodeYAxisLabel}
      linkYAxisLabel={linkYAxisLabel}
      nodeDecimals={nodeDecimals}
      linkDecimals={linkDecimals}
      unitLabels={unitLabels}
    />
  );
});

interface SplitChartsProps {
  seriesData: CustomGraphChartProps["seriesData"];
  nodeCount: number;
  nodeYAxisLabel: string;
  linkYAxisLabel: string;
  nodeDecimals: number;
  linkDecimals: number;
  unitLabels: string[];
}

const SplitCharts = memo(function SplitCharts({
  seriesData,
  nodeCount,
  nodeYAxisLabel,
  linkYAxisLabel,
  nodeDecimals,
  linkDecimals,
  unitLabels,
}: SplitChartsProps) {
  const nodeData = useMemo(
    () => seriesData.slice(0, nodeCount),
    [seriesData, nodeCount],
  );
  const linkData = useMemo(
    () => seriesData.slice(nodeCount),
    [seriesData, nodeCount],
  );
  const nodeUnitLabel = unitLabels[0] ?? "";
  const linkUnitLabel = unitLabels[nodeCount] ?? "";

  const topChartRef = useRef<ReactECharts>(null);
  const bottomChartRef = useRef<ReactECharts>(null);

  const handleTopAxisPointer = useCallback((params: { dataIndex?: number }) => {
    const bottom = bottomChartRef.current?.getEchartsInstance();
    if (!bottom || params.dataIndex === undefined) return;
    bottom.dispatchAction({
      type: "showTip",
      seriesIndex: 0,
      dataIndex: params.dataIndex,
    });
  }, []);

  const handleBottomAxisPointer = useCallback(
    (params: { dataIndex?: number }) => {
      const top = topChartRef.current?.getEchartsInstance();
      if (!top || params.dataIndex === undefined) return;
      top.dispatchAction({
        type: "showTip",
        seriesIndex: 0,
        dataIndex: params.dataIndex,
      });
    },
    [],
  );

  const handleHideTooltip = useCallback((target: "top" | "bottom") => {
    const other =
      target === "top"
        ? bottomChartRef.current?.getEchartsInstance()
        : topChartRef.current?.getEchartsInstance();
    other?.dispatchAction({ type: "hideTip" });
  }, []);

  return (
    <div className="flex flex-col h-full w-full gap-1">
      <div className="flex-1 min-h-0">
        <SingleChart
          ref={topChartRef}
          seriesData={nodeData}
          yAxisLabel={nodeYAxisLabel}
          decimals={nodeDecimals}
          unitLabel={nodeUnitLabel}
          showXAxisLabels={false}
          onAxisPointer={handleTopAxisPointer}
          onMouseOut={() => handleHideTooltip("top")}
        />
      </div>
      <div className="flex-1 min-h-0">
        <SingleChart
          ref={bottomChartRef}
          seriesData={linkData}
          yAxisLabel={linkYAxisLabel}
          decimals={linkDecimals}
          unitLabel={linkUnitLabel}
          showXAxisLabels={true}
          onAxisPointer={handleBottomAxisPointer}
          onMouseOut={() => handleHideTooltip("bottom")}
        />
      </div>
    </div>
  );
});

interface SingleChartInternalProps extends SingleGraphChartProps {
  onAxisPointer?: (params: { dataIndex?: number }) => void;
  onMouseOut?: () => void;
}

const SingleChart = memo(
  forwardRef<ReactECharts, SingleChartInternalProps>(function SingleChart(
    {
      seriesData,
      yAxisLabel,
      decimals,
      unitLabel,
      showXAxisLabels,
      onAxisPointer,
      onMouseOut,
    },
    ref,
  ) {
    const chartRef = useRef<ReactECharts>(null);
    useImperativeHandle(ref, () => chartRef.current!, []);
    const containerRef = useRef<HTMLDivElement>(null);

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
      const { min, max, interval } = calculateInterval(decimals, allValues, 5);

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
                ]
              : undefined,
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
            formatter: (value: number) => localizeDecimal(value),
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
                const value = p.value.toFixed(
                  GraphDefaultOptions.TOOLTIP_DECIMALS,
                );
                const colorDot = `<span style="display:inline-block;width:8px;height:8px;background:${p.color};margin-right:4px;border-radius:50%;vertical-align:middle;"></span>`;
                return (
                  `<tr>` +
                  `<td>${colorDot}${p.seriesName ?? ""}</td>` +
                  `<td style="font-variant-numeric:tabular-nums;text-align:right;padding-left:16px;">${value}</td>` +
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
        className="h-full w-full"
        onMouseLeave={onMouseOut}
      >
        <ReactECharts
          ref={chartRef}
          key={`${intervalSeconds}-${intervalsCount}`}
          option={option}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "svg" }}
        />
      </div>
    );
  }),
);

interface CombinedChartProps {
  seriesData: CustomGraphChartProps["seriesData"];
  nodeCount: number;
  nodeYAxisLabel: string;
  linkYAxisLabel: string;
  nodeDecimals: number;
  linkDecimals: number;
  unitLabels: string[];
}

const CombinedChart = memo(function CombinedChart({
  seriesData,
  nodeCount,
  nodeYAxisLabel,
  linkYAxisLabel,
  nodeDecimals,
  linkDecimals,
  unitLabels,
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
    ) => {
      const { min, max, interval } = calculateInterval(decimals, values, 5);
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
          formatter: (value: number) => localizeDecimal(value),
        },
      };
    };

    if (hasBothAxes) {
      return [
        buildYAxis(linkYAxisLabel, linkDecimals, linkValues, "left", true),
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
        };
      }),
    [seriesData, nodeCount, hasBothAxes],
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
              const value = p.value.toFixed(
                GraphDefaultOptions.TOOLTIP_DECIMALS,
              );
              const unit = unitLabels[p.seriesIndex ?? i] ?? "";
              const idx = p.seriesIndex ?? i;
              const assetType = idx < nodeCount ? "node" : "link";
              const colorDot = `<span style="display:inline-block;width:8px;height:8px;background:${p.color};margin-right:4px;border-radius:50%;vertical-align:middle;"></span>`;
              return (
                `<tr>` +
                `<td>${colorDot}${p.seriesName ?? ""} <span style="color:${colors.gray400}">(${assetType})</span></td>` +
                `<td style="font-variant-numeric:tabular-nums;text-align:right;padding-left:16px;">${value}</td>` +
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
    [seriesData, xAxis, yAxis, series, unitLabels, nodeCount],
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

const buildTimeLabels = (
  intervalsCount: number,
  intervalSeconds: number,
): string[] => {
  const labels: string[] = [];
  for (let i = 0; i < intervalsCount; i++) {
    const totalSeconds = i * intervalSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    labels.push(
      `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
    );
  }
  return labels;
};

const calculateXAxisInterval = (
  intervalCount: number,
  intervalSeconds: number,
  targetTickCount = 8,
) => {
  const totalSeconds = intervalCount * intervalSeconds;
  const idealStep = totalSeconds / (targetTickCount - 1 || 1);
  const logicalSteps = [3600, 7200, 10800, 14400, 21600, 28800, 43200, 86400];
  const bestStepSeconds = logicalSteps.reduce((prev, curr) =>
    Math.abs(curr - idealStep) < Math.abs(prev - idealStep) ? curr : prev,
  );
  const indexInterval = Math.max(
    1,
    Math.round(bestStepSeconds / intervalSeconds),
  );
  return (index: number) => index % indexInterval === 0;
};

const calculateXAxisStep = (
  intervalCount: number,
  intervalSeconds: number,
  targetTickCount = 8,
): number => {
  const totalSeconds = intervalCount * intervalSeconds;
  const rawStep = totalSeconds / Math.max(targetTickCount - 1, 1);
  const step = [3600, 7200, 10800, 14400, 21600, 28800, 43200, 86400].reduce(
    (prev, curr) =>
      Math.abs(curr - rawStep) < Math.abs(prev - rawStep) ? curr : prev,
  );
  return Math.max(1, Math.round(step / intervalSeconds));
};

const calculateInterval = (
  decimals: number,
  values: number[],
  targetIntervalsCount = 5,
): { min: number; max: number; interval: number } => {
  if (values.length === 0) return { min: 0, max: 0, interval: 0 };

  const factor = Math.pow(10, decimals);
  let rawMin = Infinity;
  let rawMax = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < rawMin) rawMin = v;
    if (v > rawMax) rawMax = v;
  }
  const minVal = Math.floor(rawMin * factor) / factor;
  const maxVal = Math.ceil(rawMax * factor) / factor;
  const range = maxVal - minVal;

  const minPrecision = Math.pow(10, -decimals + 1);
  let niceInterval = minPrecision;
  if (range > 0) {
    const roughInterval = range / (targetIntervalsCount - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));
    const normalizedInterval = roughInterval / magnitude;
    const niceFactor = [1, 2, 2.5, 5, 10].reduce((prev, curr) =>
      Math.abs(curr - normalizedInterval) < Math.abs(prev - normalizedInterval)
        ? curr
        : prev,
    );
    niceInterval = Math.max(
      Math.round(niceFactor * magnitude * factor) / factor,
      minPrecision,
    );
  }
  if (niceInterval > minPrecision) {
    const min = Math.floor(minVal / niceInterval) * niceInterval;
    const max = Math.ceil(maxVal / niceInterval) * niceInterval;
    return { min, max, interval: niceInterval };
  }

  const offset =
    (targetIntervalsCount - 1) * minPrecision - Math.abs(maxVal - minVal);
  const halfOffset = offset / 2;

  let min: number;
  let max: number;
  if (minVal >= 0 && minVal < halfOffset) {
    const maxOffset = offset - minVal;
    min = 0;
    max = Math.floor((maxVal + maxOffset) / minPrecision) * minPrecision;
  } else {
    min = Math.ceil((minVal - halfOffset) / minPrecision) * minPrecision;
    max = Math.floor((maxVal + halfOffset) / minPrecision) * minPrecision;
  }

  while (min > minVal) min -= minPrecision;
  while (max < maxVal) max += minPrecision;

  return { min, max, interval: minPrecision };
};
