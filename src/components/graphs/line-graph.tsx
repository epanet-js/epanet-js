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
}

interface LineGraphProps {
  points: StyledPointValue[];
  onPointClick?: (index: number | null) => void;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export function LineGraph({
  points,
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
    const xValues = points.map((p) => p.x);
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
  }, [points, xAxisLabel]);

  const yAxis: EChartsOption["yAxis"] = useMemo(() => {
    const yValues = points.map((p) => p.y);
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
  }, [points, yAxisLabel]);

  const series: EChartsOption["series"] = useMemo(() => {
    const data = points.map((p) => ({
      value: [p.x, p.y],
      itemStyle: p.itemStyle ?? { color: colors.purple500 },
    }));

    return [
      {
        type: "line",
        data,
        showSymbol: true,
        symbol: "circle",
        symbolSize: 8,
        lineStyle: {
          color: colors.purple500,
          width: 2,
        },
        emphasis: {
          itemStyle: {
            color: colors.fuchsia500,
          },
        },
      },
    ];
  }, [points]);

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

    zr.on("click", (params: { offsetX: number; offsetY: number }) => {
      const pointInPixel = [params.offsetX, params.offsetY];
      if (!chart.containPixel("grid", pointInPixel)) {
        onPointClickRef.current?.(null);
        return;
      }

      // Find the closest point to the click
      const pointInGrid = chart.convertFromPixel("grid", pointInPixel);
      const clickX = pointInGrid[0];
      const clickY = pointInGrid[1];

      // Get the data from the chart option
      const opt = chart.getOption() as EChartsOption;
      const seriesData = (
        opt.series as { data: { value: [number, number] }[] }[]
      )?.[0]?.data;

      if (!seriesData || seriesData.length === 0) {
        onPointClickRef.current?.(null);
        return;
      }

      // Find closest point within a reasonable threshold
      let closestIndex: number | null = null;
      let minDistance = Infinity;

      seriesData.forEach((item, index) => {
        const [px, py] = item.value;
        const distance = Math.sqrt(
          Math.pow(clickX - px, 2) + Math.pow(clickY - py, 2),
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });

      // Only select if within a threshold (in data units)
      const xRange =
        (opt.xAxis as { max: number; min: number }).max -
        (opt.xAxis as { max: number; min: number }).min;
      const yRange =
        (opt.yAxis as { max: number; min: number }).max -
        (opt.yAxis as { max: number; min: number }).min;
      const threshold = Math.max(xRange, yRange) * 0.1;

      if (minDistance <= threshold) {
        onPointClickRef.current?.(closestIndex);
      } else {
        onPointClickRef.current?.(null);
      }
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
