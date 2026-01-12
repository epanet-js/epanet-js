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

  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < intervalsCount; i++) {
      const totalSeconds = i * intervalSeconds;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      labels.push(`${hours}:${minutes.toString().padStart(2, "0")}`);
    }
    return labels;
  }, [intervalsCount, intervalSeconds]);

  const yAxisMinInterval = useMemo(
    () => calculateMinInterval(decimals, values),
    [values, decimals],
  );

  const option: EChartsOption = useMemo(() => {
    return {
      animation: false,
      grid: {
        top: 8,
        right: 8,
        bottom: 4,
        left: 36,
        containLabel: false,
      },
      xAxis: {
        type: "category",
        data: timeLabels,
        show: false,
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        scale: true,
        minInterval: yAxisMinInterval,
        splitNumber: 1,
        splitLine: { show: true, lineStyle: { color: colors.gray300 } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: colors.gray500,
          fontSize: 12,
          formatter: (value: number) => {
            return localizeDecimal(value, { decimals });
          },
        },
      },
      series: [
        {
          type: "line",
          data: values,
          lineStyle: {
            color: colors.purple500,
            width: 1.5,
          },
          symbol: "none",
          smooth: false,
          triggerLineEvent: true,
          markLine: {
            silent: true,
            symbol: "none",
            data: [{ xAxis: currentIntervalIndex }],
            lineStyle: {
              type: "dashed",
              color: colors.gray500,
              width: 1,
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
  }, [timeLabels, yAxisMinInterval, values, currentIntervalIndex, decimals]);

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

const calculateMinInterval = (decimals: number, values: number[]) => {
  const factor = Math.pow(10, decimals);
  const minVal =
    values.length > 0 ? Math.floor(Math.min(...values) * factor) / factor : 0;
  const maxVal =
    values.length > 0 ? Math.ceil(Math.max(...values) * factor) / factor : 0;

  const dataRange = Math.abs(maxVal - minVal);
  const precisionInterval = Math.pow(10, -decimals + 1);
  const rangeBasedInterval =
    dataRange > 0 ? Math.ceil((dataRange / 3) * factor) / factor : 0;

  return rangeBasedInterval < precisionInterval
    ? precisionInterval
    : rangeBasedInterval;
};
