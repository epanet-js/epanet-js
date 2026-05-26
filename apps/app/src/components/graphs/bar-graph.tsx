import { useMemo, useRef, useEffect, useCallback } from "react";
import ReactECharts, { EChartsInstance } from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { colors } from "src/lib/constants";

export interface StyledBarValue {
  value: number;
  itemStyle: { color: string };
}

export type BarValue = number | StyledBarValue;

interface BarGraphProps {
  values: BarValue[];
  labels: string[];
  startYAxisAtZero?: boolean;
  onBarClick?: (index: number | null) => void;
}

export function BarGraph({
  values,
  labels,
  startYAxisAtZero = true,
  onBarClick,
}: BarGraphProps) {
  const translate = useTranslate();
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onBarClickRef = useRef(onBarClick);
  onBarClickRef.current = onBarClick;

  const xAxis: EChartsOption["xAxis"] = useMemo(
    () => ({
      type: "category",
      data: labels,
      axisLine: { show: true, lineStyle: { color: colors.gray300 } },
      axisTick: {
        show: true,
        alignWithLabel: true,
        lineStyle: { color: colors.gray300 },
      },
      axisLabel: {
        show: true,
        color: colors.gray500,
        fontSize: 12,
        interval: calculateLabelInterval(labels.length),
      },
    }),
    [labels],
  );

  const yAxis: EChartsOption["yAxis"] = useMemo(() => {
    const numericValues = values.map((v) =>
      typeof v === "number" ? v : v.value,
    );
    return buildYAxis(numericValues, startYAxisAtZero);
  }, [values, startYAxisAtZero]);

  const series: EChartsOption["series"] = useMemo(() => {
    return [
      {
        type: "bar",
        data: values.map((v) => {
          const color =
            typeof v === "number" ? colors.purple500 : v.itemStyle.color;
          return {
            value: typeof v === "number" ? v : v.value,
            itemStyle: { color },
          };
        }),
        barMaxWidth: 40,
        emphasis: {
          itemStyle: {
            color: colors.fuchsia500,
          },
        },
      },
    ];
  }, [values]);

  const option: EChartsOption = useMemo(
    () => ({
      animation: false,
      grid: {
        top: 16,
        right: 16,
        bottom: 24,
        left: 40,
        containLabel: false,
      },
      xAxis,
      yAxis,
      series,
      tooltip: {
        trigger: "axis",
        backgroundColor: "white",
        borderColor: colors.gray300,
        textStyle: {
          color: colors.gray700,
          fontSize: 14,
        },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const p = params[0] as { name: string; value: number };
          const label = (p.name ?? "").trim();
          const value = localizeDecimal(p.value, { decimals: 2 });
          return [label, value].filter(Boolean).join("<br/>");
        },
      },
    }),
    [xAxis, yAxis, series],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      const chart = chartRef.current?.getEchartsInstance();
      chart?.resize();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const onChartReady = useCallback((chart: EChartsInstance) => {
    const zr = chart.getZr();

    zr.on("click", (params: { offsetX: number; offsetY: number }) => {
      const pointInPixel = [params.offsetX, params.offsetY];
      if (!chart.containPixel("grid", pointInPixel)) {
        onBarClickRef.current?.(null);
        return;
      }

      const pointInGrid = chart.convertFromPixel("grid", pointInPixel);
      const dataIndex = Math.round(pointInGrid[0]);
      onBarClickRef.current?.(dataIndex);
    });

    zr.on("mousemove", (params: { offsetX: number; offsetY: number }) => {
      const pointInPixel = [params.offsetX, params.offsetY];
      const isInGrid = chart.containPixel("grid", pointInPixel);
      zr.setCursorStyle(isInGrid ? "pointer" : "default");
    });
  }, []);

  if (values.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-xs">
        {translate("noDataAvailable")}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge={true}
        onChartReady={onChartReady}
      />
    </div>
  );
}

const calculateLabelInterval = (count: number): number => {
  if (count <= 6) return 0;
  if (count <= 12) return 1;
  if (count <= 24) return 2;
  return Math.floor(count / 8);
};

const buildYAxis = (
  values: number[],
  startAtZero: boolean,
): EChartsOption["yAxis"] => {
  const { min, max, interval } = calculateInterval(values, startAtZero);
  return {
    type: "value",
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
      formatter: (value: number) => localizeDecimal(value, { decimals: 2 }),
    },
  };
};

export const calculateInterval = (
  values: number[],
  startAtZero: boolean,
  targetIntervalsCount = 5,
): { min: number; max: number; interval: number } => {
  if (values.length === 0) return { min: 0, max: 1, interval: 0.2 };

  const decimals = 2;
  const factor = Math.pow(10, decimals);
  const minPrecision = Math.pow(10, -decimals + 1);

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  let minVal: number;
  let maxVal: number;

  if (startAtZero) {
    minVal = Math.floor(Math.min(rawMin, 0) * factor) / factor;
    maxVal = Math.ceil(Math.max(rawMax, 1) * factor) / factor;
  } else {
    // Add 30% padding around the data range so variations are visible
    const dataRange = rawMax - rawMin;
    const padding = Math.max(dataRange * 0.3, minPrecision);
    minVal = Math.floor((rawMin - padding) * factor) / factor;
    maxVal = Math.ceil((rawMax + padding) * factor) / factor;
  }

  const range = maxVal - minVal;

  if (range <= 0) {
    // All values identical — create a range around the value
    const center = rawMin;
    const halfSpan = Math.max(Math.abs(center) * 0.3, minPrecision * 2);
    const fallbackMin =
      Math.floor((center - halfSpan) / minPrecision) * minPrecision;
    const fallbackMax =
      Math.ceil((center + halfSpan) / minPrecision) * minPrecision;
    return {
      min: fallbackMin,
      max: fallbackMax,
      interval: minPrecision,
    };
  }

  const roughInterval = range / (targetIntervalsCount - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));
  const normalizedInterval = roughInterval / magnitude;

  const niceFactor = [1, 2, 2.5, 5, 10].reduce((prev, curr) =>
    Math.abs(curr - normalizedInterval) < Math.abs(prev - normalizedInterval)
      ? curr
      : prev,
  );

  const niceInterval = Math.max(
    Math.round(niceFactor * magnitude * factor) / factor,
    minPrecision,
  );
  let min = Math.floor(minVal / niceInterval) * niceInterval;
  let max = Math.ceil(maxVal / niceInterval) * niceInterval;

  // Ensure computed range contains all data points
  while (min > rawMin) min -= niceInterval;
  while (max < rawMax) max += niceInterval;

  return { min, max, interval: niceInterval };
};
