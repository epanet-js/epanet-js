import { useMemo, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { colors } from "src/lib/constants";

interface QuickGraphChartProps {
  values: number[];
  intervalsCount: number;
  intervalSeconds: number; // seconds
  currentIntervalIndex?: number;
  decimals?: number;
  onIntevalClick?: (intervalIndex: number) => void;
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

  const option: EChartsOption = useMemo(() => {
    const markLineData =
      currentIntervalIndex !== undefined
        ? [{ xAxis: currentIntervalIndex }]
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
        scale: true,
        minInterval: decimals !== undefined ? Math.pow(10, -decimals) : 0.001,
        splitNumber: 3,
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
          markLine:
            markLineData.length > 0
              ? {
                  silent: true,
                  symbol: "none",
                  data: markLineData,
                  lineStyle: {
                    type: "dashed",
                    color: colors.gray500,
                    width: 1,
                  },
                  label: { show: false },
                }
              : undefined,
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
  }, [values, timeLabels, currentIntervalIndex, decimals]);

  const handleChartClick = useCallback(
    (params: any) => {
      if (params.dataIndex !== undefined && onIntevalClick) {
        onIntevalClick(params.dataIndex);
      }
    },
    [onIntevalClick],
  );

  const onEvents = useMemo(
    () => ({
      click: handleChartClick,
    }),
    [handleChartClick],
  );

  if (intervalsCount === 0 || values.length === 0) {
    return (
      <div className="h-[100px] flex items-center justify-center text-gray-400 text-xs">
        {translate("noDataAvailable")}
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
