import { useMemo, useCallback, useRef, useEffect } from "react";
import ReactECharts, { EChartsInstance } from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { colors } from "src/lib/constants";

interface QuickGraphChartProps {
  values: number[];
  intervalsCount: number;
  intervalSeconds: number;
  decimals: number;
  currentIntervalIndex: number;
  onIntevalClick: (intervalIndex: number) => void;
}

export function QuickGraphChart(props: QuickGraphChartProps) {
  return <QuickGraphChartECharts {...props} />;
}

function QuickGraphChartECharts({
  values,
  intervalsCount,
  intervalSeconds,
  currentIntervalIndex,
  decimals,
  onIntevalClick,
}: QuickGraphChartProps) {
  const translate = useTranslate();

  const xAxis: EChartsOption["xAxis"] = useMemo(
    () => buildXAxis(intervalsCount, intervalSeconds),
    [intervalsCount, intervalSeconds],
  );
  const yAxis: EChartsOption["yAxis"] = useMemo(
    () => buildYAxis(values, decimals),
    [values, decimals],
  );

  const option: EChartsOption = {
    animation: false,
    grid: {
      top: 8,
      right: 8,
      bottom: 4,
      left: 36,
      containLabel: false,
    },
    xAxis,
    yAxis,
    series: [
      {
        type: "line",
        data: values,
        lineStyle: {
          color: colors.purple500,
          width: 2,
        },
        symbol: "none",
        smooth: false,
        triggerLineEvent: true,
        markLine: {
          silent: true,
          symbol: "none",
          data: [{ xAxis: currentIntervalIndex }],
          lineStyle: {
            type: "solid",
            color: colors.purple300,
            width: 1.5,
          },
          label: { show: false },
        },
      },
    ],
    tooltip: {
      trigger: "axis",
      backgroundColor: "white",
      borderColor: colors.gray300,
      textStyle: {
        color: colors.gray700,
        fontSize: 12,
      },
      formatter: (params: any) => {
        const data = params[0];
        if (!data) return "";
        const value = localizeDecimal(data.value, { decimals });

        return `${data.name}<br/>${value}`;
      },
    },
  };

  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const onChartReady = useCallback(
    (chart: EChartsInstance) => {
      const zr = chart.getZr();

      zr.on("click", (params: any) => {
        const pointInPixel = [params.offsetX, params.offsetY];
        if (!chart.containPixel("grid", pointInPixel)) return;

        const pointInGrid = chart.convertFromPixel("grid", pointInPixel);
        const dataIndex = Math.round(pointInGrid[0]);
        if (dataIndex >= 0 && dataIndex < values.length) {
          onIntevalClick(dataIndex);
        }
      });

      zr.on("mousemove", (params: any) => {
        const pointInPixel = [params.offsetX, params.offsetY];
        const isInGrid = chart.containPixel("grid", pointInPixel);
        zr.setCursorStyle(isInGrid ? "pointer" : "default");
      });
    },
    [onIntevalClick, values.length],
  );

  if (intervalsCount === 0 || values.length === 0) {
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
        onChartReady={onChartReady}
        notMerge={true}
      />
    </div>
  );
}

const buildXAxis = (
  intervalsCount: number,
  intervalSeconds: number,
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
      show: true,
      interval: xAxisInterval,
      color: colors.gray500,
      fontSize: 12,
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

export const calculateInterval = (
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

  const minPrecision = Math.pow(10, -decimals + 1);
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

    niceInterval = Math.round(niceFactor * magnitude * factor) / factor;
  }
  if (niceInterval > minPrecision) {
    const min = Math.floor(minVal / niceInterval) * niceInterval;
    const max = Math.ceil(maxVal / niceInterval) * niceInterval;
    return { min, max, interval: niceInterval };
  }

  const offset =
    (targetIntervalsCount - 1) * minPrecision - Math.abs(maxVal - minVal);
  const halfOffset = offset / 2;

  if (minVal >= 0 && minVal < halfOffset) {
    const maxOffset = offset - minVal;
    return {
      min: 0,
      max: Math.floor((maxVal + maxOffset) / minPrecision) * minPrecision,
      interval: minPrecision,
    };
  }
  return {
    min: Math.ceil((minVal - halfOffset) / minPrecision) * minPrecision,
    max: Math.floor((maxVal + halfOffset) / minPrecision) * minPrecision,
    interval: minPrecision,
  };
};
