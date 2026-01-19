import { useMemo, useRef, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { colors } from "src/lib/constants";

interface BarGraphProps {
  values: number[];
  labels: string[];
}

export function BarGraph({ values, labels }: BarGraphProps) {
  const translate = useTranslate();
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const xAxis: EChartsOption["xAxis"] = useMemo(
    () => ({
      type: "category",
      data: labels,
      axisLine: { show: true, lineStyle: { color: colors.gray300 } },
      axisTick: { show: true, lineStyle: { color: colors.gray300 } },
      axisLabel: {
        show: true,
        color: colors.gray500,
        fontSize: 11,
        interval: calculateLabelInterval(labels.length),
      },
    }),
    [labels],
  );

  const yAxis: EChartsOption["yAxis"] = useMemo(
    () => buildYAxis(values),
    [values],
  );

  const series: EChartsOption["series"] = useMemo(
    () => [
      {
        type: "bar",
        data: values,
        itemStyle: {
          color: colors.purple500,
        },
        barMaxWidth: 40,
      },
    ],
    [values],
  );

  const option: EChartsOption = {
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
        fontSize: 12,
      },
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const p = params[0] as { name: string; value: number };
        const timeLabel = p.name ?? "";
        const value = localizeDecimal(p.value, { decimals: 2 });
        return `${timeLabel}<br/>${value}`;
      },
    },
  };

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

const buildYAxis = (values: number[]): EChartsOption["yAxis"] => {
  const { min, max, interval } = calculateInterval(values);
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
      fontSize: 11,
      formatter: (value: number) => localizeDecimal(value, { decimals: 2 }),
    },
  };
};

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
