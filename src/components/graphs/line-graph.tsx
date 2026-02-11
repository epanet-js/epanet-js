import { useMemo, useRef, useEffect, useCallback } from "react";
import ReactECharts, { EChartsInstance } from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { colors } from "src/lib/constants";

export interface StyledPointValue {
  x: number;
  y: number;
  itemStyle?: { color: string };
  symbol?: string;
  symbolSize?: number;
  lineStyle?: { color: string };
}

interface LineGraphProps {
  points: StyledPointValue[];
  linePoints?: StyledPointValue[];
  onPointClick?: (index: number | null) => void;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export function LineGraph({
  points,
  linePoints,
  onPointClick,
  xAxisLabel,
  yAxisLabel,
}: LineGraphProps) {
  const translate = useTranslate();
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onPointClickRef = useRef(onPointClick);
  onPointClickRef.current = onPointClick;

  const xAxis: EChartsOption["xAxis"] = useMemo(() => {
    const xValues = linePoints
      ? [...points.map((p) => p.x), ...linePoints.map((p) => p.x)]
      : points.map((p) => p.x);
    const { min, max, interval } = calculateInterval(xValues);
    return {
      type: "value",
      min,
      max,
      interval,
      name: xAxisLabel,
      nameLocation: "middle",
      nameGap: 24,
      nameTextStyle: {
        color: colors.gray500,
        fontSize: 11,
      },
      axisLine: { show: true, lineStyle: { color: colors.gray300 } },
      axisTick: { show: true, lineStyle: { color: colors.gray300 } },
      splitLine: {
        show: true,
        lineStyle: { color: colors.gray300, type: "dashed" },
      },
      axisLabel: {
        show: true,
        color: colors.gray500,
        fontSize: 11,
        formatter: (value: number) => localizeDecimal(value, { decimals: 2 }),
      },
    };
  }, [points, linePoints, xAxisLabel]);

  const yAxis: EChartsOption["yAxis"] = useMemo(() => {
    const yValues = linePoints
      ? [...points.map((p) => p.y), ...linePoints.map((p) => p.y)]
      : points.map((p) => p.y);
    const { min, max, interval } = calculateInterval(yValues);
    return {
      type: "value",
      min,
      max,
      interval,
      name: yAxisLabel,
      nameLocation: "middle",
      nameGap: 40,
      nameTextStyle: {
        color: colors.gray500,
        fontSize: 11,
      },
      splitLine: {
        show: true,
        lineStyle: { color: colors.gray300, type: "dashed" },
      },
      axisLine: { show: true, lineStyle: { color: colors.gray300 } },
      axisTick: { show: true, lineStyle: { color: colors.gray300 } },
      axisLabel: {
        color: colors.gray500,
        fontSize: 11,
        formatter: (value: number) => localizeDecimal(value, { decimals: 2 }),
      },
    };
  }, [points, linePoints, yAxisLabel]);

  const series: EChartsOption["series"] = useMemo(() => {
    const scatterData = points.map((p) => ({
      value: [p.x, p.y],
      itemStyle: p.itemStyle ?? { color: colors.purple500 },
      symbol: p.symbol,
      symbolSize: p.symbolSize,
    }));

    const result: EChartsOption["series"] = [];

    if (linePoints && linePoints.length > 0) {
      for (const segment of splitLineSegments(linePoints)) {
        result.push({
          type: "line",
          data: segment.points.map((p) => ({ value: [p.x, p.y] })),
          showSymbol: false,
          lineStyle: {
            color: segment.color,
            width: 2,
          },
          emphasis: { disabled: true },
          tooltip: { show: false },
        });
      }
    }

    result.push({
      type: "scatter",
      data: scatterData,
      symbol: "circle",
      symbolSize: 8,
      emphasis: {
        itemStyle: {
          color: colors.fuchsia500,
        },
      },
      z: 10,
    });

    return result;
  }, [points, linePoints]);

  const option: EChartsOption = useMemo(
    () => ({
      animation: false,
      grid: {
        top: 16,
        right: 16,
        bottom: xAxisLabel ? 40 : 24,
        left: yAxisLabel ? 56 : 40,
        containLabel: false,
      },
      xAxis,
      yAxis,
      series,
      tooltip: {
        trigger: "item",
        backgroundColor: "white",
        borderColor: colors.gray300,
        textStyle: {
          color: colors.gray700,
          fontSize: 12,
        },
        formatter: (params: unknown) => {
          const p = params as { value: [number, number] };
          const xVal = localizeDecimal(p.value[0], { decimals: 2 });
          const yVal = localizeDecimal(p.value[1], { decimals: 2 });
          const xLabel = xAxisLabel ?? "X";
          const yLabel = yAxisLabel ?? "Y";
          return `${xLabel}: ${xVal}<br/>${yLabel}: ${yVal}`;
        },
      },
    }),
    [xAxis, yAxis, series, xAxisLabel, yAxisLabel],
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
    let handledBySeriesClick = false;

    chart.on("click", (params: { dataIndex: number; seriesType?: string }) => {
      if (params.seriesType !== "scatter") return;
      handledBySeriesClick = true;
      onPointClickRef.current?.(params.dataIndex);
    });

    zr.on("click", () => {
      if (handledBySeriesClick) {
        handledBySeriesClick = false;
        return;
      }
      onPointClickRef.current?.(null);
    });

    zr.on("mousemove", (params: { offsetX: number; offsetY: number }) => {
      const pointInPixel = [params.offsetX, params.offsetY];
      const isInGrid = chart.containPixel("grid", pointInPixel);
      zr.setCursorStyle(isInGrid ? "pointer" : "default");
    });
  }, []);

  if (points.length === 0) {
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

const calculateInterval = (
  values: number[],
  targetIntervalsCount = 5,
): { min: number; max: number; interval: number } => {
  if (values.length === 0) return { min: 0, max: 1, interval: 0.2 };

  const decimals = 2;
  const factor = Math.pow(10, decimals);
  const minVal = Math.floor(Math.min(...values, 0) * factor) / factor;
  const maxVal = Math.ceil(Math.max(...values, 1) * factor) / factor;
  const range = maxVal - minVal;

  if (range === 0) return { min: 0, max: 1, interval: 0.2 };

  const roughInterval = range / (targetIntervalsCount - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));
  const normalizedInterval = roughInterval / magnitude;

  const niceFactor = [1, 2, 2.5, 5, 10].reduce((prev, curr) =>
    Math.abs(curr - normalizedInterval) < Math.abs(prev - normalizedInterval)
      ? curr
      : prev,
  );

  const niceInterval = Math.round(niceFactor * magnitude * factor) / factor;
  const min = Math.floor(minVal / niceInterval) * niceInterval;
  const max = Math.ceil(maxVal / niceInterval) * niceInterval;

  return { min, max, interval: niceInterval };
};

const splitLineSegments = (
  points: StyledPointValue[],
): { points: StyledPointValue[]; color: string }[] => {
  if (points.length < 2) return [];

  const segments: { points: StyledPointValue[]; color: string }[] = [];
  let currentColor = points[0].lineStyle?.color ?? colors.purple500;
  let currentPoints = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const segmentColor = points[i].lineStyle?.color ?? colors.purple500;
    if (segmentColor !== currentColor) {
      currentPoints.push(points[i]);
      segments.push({ points: currentPoints, color: currentColor });
      currentColor = segmentColor;
      currentPoints = [points[i]];
    } else {
      currentPoints.push(points[i]);
    }
  }

  if (currentPoints.length >= 2) {
    segments.push({ points: currentPoints, color: currentColor });
  }

  return segments;
};
