import type { EChartsOption, SeriesOption } from "echarts";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { roundToSignificantDigits } from "src/infra/rounding";

export const STRIP_GRID_TOP = 8;
export const STRIP_GRID_HEIGHT = 30;
const STRIP_PROFILE_GAP = 4;
const SIMULATION_TOP_PADDING = 0;
const CHART_PADDING = 18;
const Y_AXIS_TICK_LENGTH = 14;
const X_AXIS_TICK_LENGTH = 8;
export const Y_AXIS_LABEL_MARGIN = 22;
export const X_AXIS_LABEL_MARGIN = 14;
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
  lengthDecimals: number;
  elevationDecimals: number;
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
  lengthDecimals,
  elevationDecimals,
}: ProfileChartOptionParams): EChartsOption {
  const axisPointer = {
    show: false,
    type: "line",
    snap: false,
    triggerTooltip: false,
    label: { show: false },
    lineStyle: { color: AXIS_POINTER_COLOR, width: 1, type: "dashed" },
  };

  const formatLength = (val: number) =>
    localizeDecimal(roundToSignificantDigits(val, 3), {
      decimals: lengthDecimals,
    });
  const formatElevation = (val: number) =>
    localizeDecimal(val, { decimals: elevationDecimals });

  const yMinRounded = Math.round(yMin);
  const yMaxRounded = Math.round(yMax);
  const yIntervalRounded = Math.round(yInterval);

  return {
    animation: false,
    grid: [
      {
        top: profileGridTop,
        right: CHART_PADDING,
        bottom: CHART_PADDING,
        left: CHART_PADDING,
        containLabel: true,
      },
      {
        top: STRIP_GRID_TOP,
        height: STRIP_GRID_HEIGHT,
        right: CHART_PADDING,
        left: CHART_PADDING,
        containLabel: true,
      },
    ],
    xAxis: [
      {
        type: "value",
        min: 0,
        max: xMax,
        splitLine: { show: true, lineStyle: { color: SPLIT_LINE_COLOR } },
        axisTick: {
          length: X_AXIS_TICK_LENGTH,
          customValues: xTickPositions,
        } as any,
        axisLabel: {
          hideOverlap: true,
          margin: X_AXIS_LABEL_MARGIN,
          customValues: xTickPositions,
          formatter: formatLength,
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
        min: yMinRounded,
        max: yMaxRounded,
        interval: yIntervalRounded,
        axisTick: { length: Y_AXIS_TICK_LENGTH },
        axisLabel: {
          fontSize: 12,
          margin: Y_AXIS_LABEL_MARGIN,
          formatter: formatElevation,
        },
      },
      {
        gridIndex: 1,
        type: "value",
        min: yMinRounded,
        max: yMaxRounded,
        interval: yIntervalRounded,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          fontSize: 12,
          color: "transparent",
          margin: Y_AXIS_LABEL_MARGIN,
          formatter: formatElevation,
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
