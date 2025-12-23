import { useMemo, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { QuickGraphChartVisx } from "./quick-graph-chart-visx";

// Toggle between chart implementations: "echarts" | "visx"
const CHART_LIBRARY: "echarts" | "visx" = "visx";

interface QuickGraphChartProps {
  values: Float32Array | number[];
  timestepCount: number;
  reportingTimeStep: number; // seconds
  currentTimestepIndex?: number;
  onTimestepClick?: (timestepIndex: number) => void;
  isDarkMode?: boolean;
  noDataMessage?: string;
}

export function QuickGraphChart(props: QuickGraphChartProps) {
  if (CHART_LIBRARY === "visx") {
    return <QuickGraphChartVisx {...props} />;
  }

  return <QuickGraphChartECharts {...props} />;
}

function QuickGraphChartECharts({
  values,
  timestepCount,
  reportingTimeStep,
  currentTimestepIndex,
  onTimestepClick,
  isDarkMode = false,
  noDataMessage = "No data available",
}: QuickGraphChartProps) {
  // Convert Float32Array to regular array for ECharts
  const chartData = useMemo(() => {
    return Array.from(values);
  }, [values]);

  // Generate time labels (e.g., "0:00", "1:00", etc.)
  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < timestepCount; i++) {
      const totalSeconds = i * reportingTimeStep;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      labels.push(`${hours}:${minutes.toString().padStart(2, "0")}`);
    }
    return labels;
  }, [timestepCount, reportingTimeStep]);

  // ECharts theme colors
  const colors = useMemo(
    () => ({
      line: "#8b5cf6", // purple-500
      areaFill: isDarkMode
        ? "rgba(139, 92, 246, 0.25)"
        : "rgba(139, 92, 246, 0.15)",
      axisLine: isDarkMode ? "#4b5563" : "#d1d5db", // gray-600 / gray-300
      axisLabel: isDarkMode ? "#9ca3af" : "#6b7280", // gray-400 / gray-500
      markLine: isDarkMode ? "#9ca3af" : "#6b7280",
      background: "transparent",
    }),
    [isDarkMode],
  );

  const option: EChartsOption = useMemo(() => {
    const markLineData =
      currentTimestepIndex !== undefined
        ? [{ xAxis: currentTimestepIndex }]
        : [];

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
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: colors.axisLabel,
          fontSize: 10,
          formatter: (value: number) => {
            if (Math.abs(value) >= 1000) {
              return `${(value / 1000).toFixed(1)}k`;
            }
            if (Math.abs(value) < 0.01 && value !== 0) {
              return value.toExponential(1);
            }
            return value.toFixed(Math.abs(value) < 1 ? 2 : 1);
          },
        },
      },
      series: [
        {
          type: "line",
          data: chartData,
          areaStyle: {
            color: colors.areaFill,
          },
          lineStyle: {
            color: colors.line,
            width: 1.5,
          },
          symbol: "none",
          smooth: false,
          markLine:
            markLineData.length > 0
              ? {
                  silent: true,
                  symbol: "none",
                  data: markLineData,
                  lineStyle: {
                    type: "dashed",
                    color: colors.markLine,
                    width: 1,
                  },
                  label: { show: false },
                }
              : undefined,
        },
      ],
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderColor: "#e5e7eb",
        textStyle: {
          color: "#1f2937",
          fontSize: 11,
        },
        formatter: (params: any) => {
          const data = params[0];
          if (!data) return "";
          const value =
            typeof data.value === "number" ? data.value.toFixed(3) : data.value;
          return `${data.name}<br/>${value}`;
        },
      },
    };
  }, [chartData, timeLabels, colors, currentTimestepIndex, isDarkMode]);

  const handleChartClick = useCallback(
    (params: any) => {
      if (params.dataIndex !== undefined && onTimestepClick) {
        onTimestepClick(params.dataIndex);
      }
    },
    [onTimestepClick],
  );

  const onEvents = useMemo(
    () => ({
      click: handleChartClick,
    }),
    [handleChartClick],
  );

  if (timestepCount === 0 || chartData.length === 0) {
    return (
      <div className="h-[100px] flex items-center justify-center text-gray-400 text-xs">
        {noDataMessage}
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: "100px", width: "100%" }}
      opts={{ renderer: "svg" }}
      onEvents={onEvents}
      notMerge={true}
    />
  );
}
