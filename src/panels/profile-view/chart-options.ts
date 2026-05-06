import type { EChartsOption, SeriesOption } from "echarts";
import { localizeDecimal } from "src/infra/i18n/numbers";

const STRIP_GRID_TOP = 6;
const STRIP_GRID_HEIGHT = 30;
const STRIP_PROFILE_GAP = 2;
const SIMULATION_TOP_PADDING = 4;
const GRID_SIDE = 12;
const GRID_BOTTOM = 12;
const SPLIT_LINE_COLOR = "#e5e7eb";
const AXIS_POINTER_COLOR = "#9ca3af";

export function profileGridTopOffset(hasSimulation: boolean): number {
  return (
    STRIP_GRID_TOP +
    STRIP_GRID_HEIGHT +
    STRIP_PROFILE_GAP +
    (hasSimulation ? SIMULATION_TOP_PADDING : 0)
  );
}

export type ProfileChartOptionParams = {
  series: SeriesOption[];
  xTickPositions: number[];
  xMax: number;
  yMin: number;
  yMax: number;
  yInterval: number;
  profileGridTop: number;
  zoomStart?: number;
  zoomEnd?: number;
};

export function buildProfileChartOption({
  series,
  xTickPositions,
  xMax,
  yMin,
  yMax,
  yInterval,
  profileGridTop,
  zoomStart = 0,
  zoomEnd = 100,
}: ProfileChartOptionParams): EChartsOption {
  const axisPointer = {
    show: true,
    type: "line",
    snap: false,
    triggerTooltip: false,
    label: { show: false },
    lineStyle: { color: AXIS_POINTER_COLOR, width: 1, type: "dashed" },
  };

  const formatInteger = (val: number) => localizeDecimal(val, { decimals: 0 });

  return {
    animation: false,
    grid: [
      {
        top: profileGridTop,
        right: GRID_SIDE,
        bottom: GRID_BOTTOM,
        left: GRID_SIDE,
        containLabel: true,
      },
      {
        top: STRIP_GRID_TOP,
        height: STRIP_GRID_HEIGHT,
        right: GRID_SIDE,
        left: GRID_SIDE,
        containLabel: true,
      },
    ],
    xAxis: [
      {
        type: "value",
        min: 0,
        max: xMax,
        nameLocation: "middle",
        splitLine: { show: true, lineStyle: { color: SPLIT_LINE_COLOR } },
        axisTick: { customValues: xTickPositions } as any,
        axisLabel: {
          hideOverlap: true,
          customValues: xTickPositions,
          formatter: formatInteger,
        } as any,
        axisPointer: axisPointer as any,
      },
      {
        gridIndex: 1,
        type: "value",
        min: 0,
        max: xMax,
        show: false,
        axisPointer: axisPointer as any,
      },
    ],
    yAxis: [
      {
        type: "value",
        min: Math.round(yMin),
        max: Math.round(yMax),
        interval: Math.round(yInterval),
        axisLabel: { fontSize: 12, formatter: formatInteger },
      },
      {
        gridIndex: 1,
        type: "value",
        min: yMin,
        max: yMax,
        interval: yInterval,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          fontSize: 12,
          color: "transparent",
          formatter: formatInteger,
        },
      },
    ],
    series,
    tooltip: { show: false },
    axisPointer: {
      link: [{ xAxisIndex: [0, 1] }],
      triggerOn: "none",
    } as any,
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: [0, 1],
        filterMode: "none",
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
        minValueSpan: 1,
        start: zoomStart,
        end: zoomEnd,
      },
    ],
  };
}
