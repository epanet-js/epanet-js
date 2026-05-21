"use client";
import { useRef, useMemo, memo, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { CustomGraphChartProps } from ".";
import { SingleChart } from "./single-chart";
import { CombinedChart } from "./combined-chart";

export const CustomGraphChart = memo(function CustomGraphChart({
  seriesData,
  nodeCount,
  nodeYAxisLabel,
  linkYAxisLabel,
  nodeDecimals,
  linkDecimals,
  unitLabels,
  combineAxes,
  linkValueFormatter,
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
        linkValueFormatter={linkValueFormatter}
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
      linkValueFormatter={linkValueFormatter}
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
  linkValueFormatter?: (value: number) => string;
}

const SplitCharts = memo(function SplitCharts({
  seriesData,
  nodeCount,
  nodeYAxisLabel,
  linkYAxisLabel,
  nodeDecimals,
  linkDecimals,
  unitLabels,
  linkValueFormatter,
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
          valueFormatter={linkValueFormatter}
        />
      </div>
    </div>
  );
});
