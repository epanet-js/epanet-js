import type { EChartsOption, SeriesOption } from "echarts";
import { localizeDecimal } from "src/infra/i18n/numbers";

const STRIP_GRID_TOP = 6;
const STRIP_GRID_HEIGHT = 30;
const STRIP_PROFILE_GAP = 2;
const SIMULATION_TOP_PADDING = 4;
const GRID_RIGHT = 24;
const GRID_LEFT = 28;
const GRID_BOTTOM = 30;
const X_AXIS_NAME_GAP = 22;
const Y_AXIS_LABEL_CHAR_WIDTH = 7;
const Y_AXIS_LABEL_MARGIN = 8;
const Y_AXIS_NAME_BUFFER = 8;
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
  xAxisName: string;
  yAxisName: string;
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
  xAxisName,
  yAxisName,
  lengthDecimals,
  elevationDecimals,
}: ProfileChartOptionParams): EChartsOption {
  const axisPointer = {
    show: true,
    type: "line",
    snap: false,
    triggerTooltip: false,
    label: { show: false },
    lineStyle: { color: AXIS_POINTER_COLOR, width: 1, type: "dashed" },
  };

  const formatLength = (val: number) =>
    localizeDecimal(val, { decimals: lengthDecimals });
  const formatElevation = (val: number) =>
    localizeDecimal(val, { decimals: elevationDecimals });

  const yLabelMagnitude = Math.max(
    Math.abs(Math.round(yMin)),
    Math.abs(Math.round(yMax)),
  );
  const yLabelSample = localizeDecimal(yLabelMagnitude, {
    decimals: elevationDecimals,
  });
  const yLabelWidthEst = yLabelSample.length * Y_AXIS_LABEL_CHAR_WIDTH;
  const yAxisNameGap =
    yLabelWidthEst + Y_AXIS_LABEL_MARGIN + Y_AXIS_NAME_BUFFER;

  const yMinRounded = Math.round(yMin);
  const yMaxRounded = Math.round(yMax);
  const yIntervalRounded = Math.round(yInterval);

  return {
    animation: false,
    grid: [
      {
        top: profileGridTop,
        right: GRID_RIGHT,
        bottom: GRID_BOTTOM,
        left: GRID_LEFT,
        containLabel: true,
      },
      {
        top: STRIP_GRID_TOP,
        height: STRIP_GRID_HEIGHT,
        right: GRID_RIGHT,
        left: GRID_LEFT,
        containLabel: true,
      },
    ],
    xAxis: [
      {
        type: "value",
        min: 0,
        max: xMax,
        name: xAxisName,
        nameLocation: "middle",
        nameGap: X_AXIS_NAME_GAP,
        splitLine: { show: true, lineStyle: { color: SPLIT_LINE_COLOR } },
        axisTick: { customValues: xTickPositions } as any,
        axisLabel: {
          hideOverlap: true,
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
        name: yAxisName,
        nameLocation: "middle",
        nameGap: yAxisNameGap,
        nameRotate: 90,
        axisLabel: { fontSize: 12, formatter: formatElevation },
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
