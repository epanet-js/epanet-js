import { memo, useMemo, useCallback, useRef, useEffect, useState } from "react";
import ReactECharts, { EChartsInstance } from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "@epanet-js/i18n";
import { colors } from "src/lib/constants";
import { QuickGraphLegend, type LegendItem } from "./quick-graph-legend";
import type { QuickGraphSeries } from "./quick-graph-chart";

interface QuickGraphChartByIndexProps {
  series: readonly QuickGraphSeries[];
  intervalsCount: number;
  intervalSeconds: number;
  decimals: number;
  currentIntervalIndex?: number;
  onIntevalClick?: (intervalIndex: number) => void;
  valueLabels?: Map<number, string> | null;
  showTimeLabels?: boolean;
  title?: string;
}

export const QuickGraphChartByIndex = memo(function QuickGraphChartByIndex(
  props: QuickGraphChartByIndexProps,
) {
  return <QuickGraphChartECharts {...props} />;
});

function QuickGraphChartECharts({
  series,
  intervalsCount,
  intervalSeconds,
  currentIntervalIndex,
  decimals,
  onIntevalClick,
  valueLabels = null,
  showTimeLabels = true,
  title,
}: QuickGraphChartByIndexProps) {
  const translate = useTranslate();

  const formatValue = useCallback(
    (value: number) =>
      valueLabels
        ? (valueLabels.get(value) ?? "")
        : localizeDecimal(value, { decimals }),
    [valueLabels, decimals],
  );

  const visibleSeries = useMemo(
    () =>
      series
        .map((entry) => ({
          ...entry,
          values: entry.values.slice(0, intervalsCount),
        }))
        .filter((entry) => entry.values.length > 0),
    [series, intervalsCount],
  );
  const [hiddenLabels, setHiddenLabels] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleSeries = useCallback(
    (label: string) =>
      setHiddenLabels((prev) => {
        const next = new Set(prev);
        if (next.has(label)) next.delete(label);
        else next.add(label);
        return next;
      }),
    [],
  );
  const isShown = useCallback(
    ({ label }: QuickGraphSeries) => label === null || !hiddenLabels.has(label),
    [hiddenLabels],
  );

  const hasSeriesNames = visibleSeries.some((entry) => entry.label !== null);
  const showLegend = hasSeriesNames;
  const showTopBand = showLegend || title !== undefined;

  const legendItems = useMemo<LegendItem[]>(
    () =>
      visibleSeries.flatMap(({ label, style }) =>
        label === null
          ? []
          : [
              {
                label,
                color: style.color,
                mark: style.type === "line" ? "line" : "points",
                hidden: hiddenLabels.has(label),
              },
            ],
      ),
    [visibleSeries, hiddenLabels],
  );

  const allValues = useMemo(
    () => visibleSeries.filter(isShown).flatMap((entry) => entry.values),
    [visibleSeries, isShown],
  );

  const xAxis: EChartsOption["xAxis"] = useMemo(
    () => buildXAxis(intervalsCount, intervalSeconds, showTimeLabels),
    [intervalsCount, intervalSeconds, showTimeLabels],
  );
  const yAxis: EChartsOption["yAxis"] = useMemo(
    () =>
      valueLabels
        ? buildDiscreteYAxis(valueLabels)
        : buildYAxis(allValues, decimals),
    [valueLabels, allValues, decimals],
  );

  const chartSeries: EChartsOption["series"] = useMemo(
    () =>
      visibleSeries
        .map((entry, index) => ({ entry, z: visibleSeries.length - index }))
        .filter(({ entry }) => isShown(entry))
        .map(({ entry, z }, index) => ({
          ...toEChartsSeries(entry),
          z,
          ...(index === 0 ? { markLine: MARK_LINE } : {}),
        })),
    [visibleSeries, isShown],
  );

  const hasShownSeries = Array.isArray(chartSeries) && chartSeries.length > 0;

  const option: EChartsOption = useMemo(
    () => ({
      animation: false,
      grid: {
        top: showTopBand ? 28 : 8,
        right: 8,
        bottom: 4,
        left: 36,
        containLabel: false,
      },
      xAxis,
      yAxis,
      series: chartSeries,
      tooltip: {
        trigger: "axis",
        appendToBody: true,
        backgroundColor: "white",
        borderColor: colors.gray300,
        textStyle: {
          color: colors.gray700,
          fontSize: 14,
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const timeLabel = showTimeLabels ? (params[0]?.name ?? "") : "";
          const lines = params.map((p: any) => {
            const value = formatValue(p.value);
            if (!hasSeriesNames) return value;
            const colorDot = `<span style="display:inline-block;width:8px;height:8px;background:${p.color};margin-right:4px;border-radius:50%;"></span>`;
            return `${colorDot}${p.seriesName ?? ""}: ${value}`;
          });
          return [timeLabel, ...lines].filter(Boolean).join("<br/>");
        },
      },
    }),
    [
      showTopBand,
      hasSeriesNames,
      xAxis,
      yAxis,
      chartSeries,
      formatValue,
      showTimeLabels,
    ],
  );

  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isChartReadyRef = useRef(false);

  useEffect(function resizeChart() {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      const chart = chartRef.current?.getEchartsInstance();
      chart?.resize();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const applyMarkLine = useCallback(
    (chart: EChartsInstance) => {
      if (!hasShownSeries) return;
      chart.setOption({
        series: [
          {
            markLine: {
              silent: true,
              symbol: "none",
              label: { show: false },
              data:
                currentIntervalIndex === undefined
                  ? []
                  : [{ xAxis: currentIntervalIndex }],
            },
          },
        ],
      });
    },
    [currentIntervalIndex, hasShownSeries],
  );

  useEffect(
    function updateMarkLinePosition() {
      if (!isChartReadyRef.current) return;
      const chart = chartRef.current?.getEchartsInstance();
      if (!chart) return;
      applyMarkLine(chart);
    },
    [applyMarkLine, option],
  );

  const onChartReady = useCallback(
    (chart: EChartsInstance) => {
      if (chart.isDisposed()) return;
      isChartReadyRef.current = true;
      applyMarkLine(chart);

      if (!onIntevalClick) return;

      const zr = chart.getZr();

      zr.on("click", (params: any) => {
        const pointInPixel = [params.offsetX, params.offsetY];
        if (!chart.containPixel("grid", pointInPixel)) return;

        const pointInGrid = chart.convertFromPixel("grid", pointInPixel);
        const dataIndex = Math.round(pointInGrid[0]);
        if (dataIndex >= 0 && dataIndex < intervalsCount) {
          onIntevalClick(dataIndex);
        }
      });

      zr.on("mousemove", (params: any) => {
        const pointInPixel = [params.offsetX, params.offsetY];
        const isInGrid = chart.containPixel("grid", pointInPixel);
        zr.setCursorStyle(isInGrid ? "pointer" : "default");
      });
    },
    [onIntevalClick, intervalsCount, applyMarkLine],
  );

  if (intervalsCount === 0 || visibleSeries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-subtle text-size-small">
        {translate("noDataAvailable")}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {showTopBand && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 h-5">
          {title !== undefined && (
            <span className="min-w-0 max-w-[50%] truncate text-size-small text-subtle">
              {title}
            </span>
          )}
          {showLegend ? (
            <QuickGraphLegend items={legendItems} onToggle={toggleSeries} />
          ) : null}
        </div>
      )}
      <ReactECharts
        ref={chartRef}
        key={`${intervalSeconds}-${intervalsCount}`}
        option={option}
        replaceMerge={["series"]}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
        onChartReady={onChartReady}
      />
    </div>
  );
}

const MARK_LINE = {
  silent: true,
  symbol: "none",
  data: [] as { xAxis: number }[],
  lineStyle: {
    type: "solid" as const,
    color: colors.purple300,
    width: 1.5,
  },
  label: { show: false },
};

const toEChartsSeries = ({ label, values, style }: QuickGraphSeries) => {
  const name = label ?? undefined;
  const data = [...values];
  if (style.type === "points") {
    return {
      type: "scatter" as const,
      name,
      data,
      symbolSize: 5,
      itemStyle: { color: style.color, opacity: 1 },
    };
  }
  return {
    type: "line" as const,
    name,
    data,
    lineStyle: { color: style.color, width: style.width ?? 2 },
    itemStyle: { color: style.color },
    symbol: "none",
    smooth: false,
    triggerLineEvent: true,
  };
};

const buildXAxis = (
  intervalsCount: number,
  intervalSeconds: number,
  showTimeLabels: boolean,
): EChartsOption["xAxis"] => {
  const xAxisInterval = calculateXAxisInterval(intervalsCount, intervalSeconds);
  const xAxisStep = calculateXAxisStep(intervalsCount, intervalSeconds);
  return {
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
      show: showTimeLabels,
      interval: xAxisInterval,
      color: colors.gray500,
      fontSize: 12,
      hideOverlap: true,
    },
    axisLine: { show: true, lineStyle: { color: colors.gray300 } },
  };
};

const buildTimeLabels = (intervalsCount: number, intervalSeconds: number) => {
  const labels: string[] = [];
  for (let i = 0; i < intervalsCount; i++) {
    const totalSeconds = i * intervalSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    labels.push(`${hours}:${minutes.toString().padStart(2, "0")}`);
  }
  return labels;
};

const calculateXAxisInterval = (
  intervalCount: number,
  intervalSeconds: number,
  targetTickCount = 5,
) => {
  const totalSeconds = intervalCount * intervalSeconds;

  const logicalSteps = [3600, 7200, 10800, 14400, 21600, 28800, 43200, 86400];

  const idealStep = totalSeconds / (targetTickCount - 1 || 1);

  const bestStepSeconds = logicalSteps.reduce((prev, curr) => {
    return Math.abs(curr - idealStep) < Math.abs(prev - idealStep)
      ? curr
      : prev;
  });

  const indexInterval = Math.round(bestStepSeconds / intervalSeconds);

  return (index: number) => {
    return index % indexInterval === 0;
  };
};

const calculateXAxisStep = (
  intervalCount: number,
  intervalSeconds: number,
  targetTickCount = 5,
): number => {
  const totalSeconds = intervalCount * intervalSeconds;
  const rawStep = totalSeconds / Math.max(targetTickCount - 1, 1);

  const step = [3600, 7200, 10800, 14400, 21600, 28800, 43200, 86400].reduce(
    (prev, curr) => {
      return Math.abs(curr - rawStep) < Math.abs(prev - rawStep) ? curr : prev;
    },
  );

  return Math.max(1, Math.round(step / intervalSeconds));
};

const buildDiscreteYAxis = (
  valueLabels: Map<number, string>,
): EChartsOption["yAxis"] => {
  const steps = [...valueLabels.keys()].sort((a, b) => a - b);
  return {
    type: "value",
    min: steps[0],
    max: steps[steps.length - 1],
    interval: 1,
    splitLine: {
      show: true,
      lineStyle: { color: colors.gray300, type: "dashed" },
    },
    axisLine: { show: true, lineStyle: { color: colors.gray300 } },
    axisTick: { show: true, lineStyle: { color: colors.gray300 } },
    axisLabel: {
      color: colors.gray500,
      fontSize: 12,
      formatter: (value: number) => valueLabels.get(value) ?? "",
    },
  };
};

const buildYAxis = (
  values: number[],
  decimals: number,
): EChartsOption["yAxis"] => {
  const { min, max, interval } = calculateInterval(decimals, values, 5);
  return {
    type: "value",
    scale: true,
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
      formatter: (value: number) => {
        return localizeDecimal(value, { decimals });
      },
    },
  };
};

const MAX_Y_AXIS_ZOOM = 0.1;

const calculateInterval = (
  decimals: number,
  values: number[],
  targetIntervalsCount = 5,
): { min: number; max: number; interval: number } => {
  if (values.length === 0) return { min: 0, max: 0, interval: 0 };

  const factor = Math.pow(10, decimals);
  const minVal =
    values.length > 0 ? Math.floor(Math.min(...values) * factor) / factor : 0;
  const maxVal =
    values.length > 0 ? Math.ceil(Math.max(...values) * factor) / factor : 0;
  const range = maxVal - minVal;

  const minPrecision = Math.max(Math.pow(10, -decimals + 1), MAX_Y_AXIS_ZOOM);
  let niceInterval = minPrecision;
  if (range > 0) {
    const roughInterval = range / (targetIntervalsCount - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));
    const normalizedInterval = roughInterval / magnitude;

    const niceFactor = [1, 2, 2.5, 5, 10].reduce((prev, curr) => {
      return Math.abs(curr - normalizedInterval) <
        Math.abs(prev - normalizedInterval)
        ? curr
        : prev;
    });

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

  // Ensure computed range contains all data points
  while (min > minVal) min -= minPrecision;
  while (max < maxVal) max += minPrecision;

  return { min, max, interval: minPrecision };
};
