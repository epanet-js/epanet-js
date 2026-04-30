import type { EChartsOption, SeriesOption } from "echarts";
import { colors } from "src/lib/constants";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { HglBandSegment, ProfileLink, ProfilePoint } from "./chart-data";
import type { StripPlanIcons } from "./use-strip-plan-icons";

type SeriesItem = SeriesOption;

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
};

export function buildProfileChartOption({
  series,
  xTickPositions,
  xMax,
  yMin,
  yMax,
  yInterval,
  profileGridTop,
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
      },
    ],
  };
}

const HGL_COLOR = "#2563eb";
const TERRAIN_COLOR = "#c8a96e";
const ELEVATION_DROPS_COLOR = "#ada9a0";
const NODE_BORDER_COLOR = "#98abeb";

// ─── Main profile pane ────────────────────────────────────────────────

export function terrainAreaPlot(
  terrainData: [number, number][] | null,
): SeriesItem | null {
  if (!terrainData) return null;
  return {
    type: "line" as const,
    name: "terrain",
    data: terrainData,
    lineStyle: { opacity: 0, width: 0 },
    itemStyle: { opacity: 0 },
    areaStyle: { color: TERRAIN_COLOR, opacity: 0.22 },
    symbol: "none",
    smooth: false,
    silent: true,
    tooltip: { show: false },
  };
}

export function hglBandPlot(
  hglBandSegments: HglBandSegment[][] | null,
): SeriesItem | null {
  if (!hglBandSegments) return null;
  return {
    type: "custom" as const,
    name: "hglBand",
    data: hglBandSegments,
    silent: true,
    tooltip: { show: false },
    z: 1,
    /* eslint-disable @typescript-eslint/no-explicit-any,
       @typescript-eslint/no-unsafe-assignment,
       @typescript-eslint/no-unsafe-call,
       @typescript-eslint/no-unsafe-member-access */
    renderItem: (params: any, api: any) => {
      const segment = hglBandSegments[params.dataIndex];
      if (!segment || segment.length < 2) return null;
      const polygon: number[][] = [];
      for (let i = 0; i < segment.length; i++) {
        polygon.push(api.coord([segment[i].x, segment[i].max]));
      }
      for (let i = segment.length - 1; i >= 0; i--) {
        polygon.push(api.coord([segment[i].x, segment[i].min]));
      }
      return {
        type: "polygon" as const,
        shape: { points: polygon },
        style: { fill: HGL_COLOR, opacity: 0.12 },
        silent: true,
      };
    },
    /* eslint-enable */
  };
}

export function elevationDropsPlot(
  elevDropsData: ([number, number] | null)[],
): SeriesItem {
  return {
    type: "line" as const,
    name: "elevDrops",
    data: elevDropsData,
    lineStyle: { color: ELEVATION_DROPS_COLOR, width: 1 },
    itemStyle: { opacity: 0 },
    symbol: "none",
    connectNulls: false,
    silent: true,
    tooltip: { show: false },
  };
}

export function elevationLinePlot(
  elevationData: [number, number][],
  lineColor: string,
  nodeColor: string,
  label: string,
): SeriesItem {
  return {
    type: "line" as const,
    name: label,
    data: elevationData,
    lineStyle: { color: lineColor, width: 1.75 },
    itemStyle: {
      color: nodeColor,
      borderColor: NODE_BORDER_COLOR,
      borderWidth: 0.75,
    },
    symbol: "circle",
    symbolSize: 5,
    smooth: false,
  };
}

export function hglDropsPlot(
  hglDropsData: ([number, number] | null)[],
): SeriesItem {
  return {
    type: "line" as const,
    name: "hglDrops",
    data: hglDropsData,
    lineStyle: { color: HGL_COLOR, width: 1.25 },
    itemStyle: { opacity: 0 },
    symbol: "none",
    connectNulls: false,
    silent: true,
    tooltip: { show: false },
  };
}

export function hglLinePlot(
  hglData: [number, number | null][],
  label: string,
): SeriesItem {
  return {
    type: "line" as const,
    name: label,
    data: hglData,
    lineStyle: { color: HGL_COLOR, width: 2 },
    itemStyle: { color: HGL_COLOR },
    symbol: "circle",
    symbolSize: 0,
    smooth: false,
  };
}

// ─── Strip pane (xAxisIndex/yAxisIndex 1) ─────────────────────────────

export function pipesStripPlot(
  links: ProfileLink[],
  pipeColor: string,
  stripY: number,
): SeriesItem | null {
  const pipes = links.filter((l) => l.type === "pipe");
  if (pipes.length === 0) return null;
  return {
    type: "line" as const,
    name: "stripPipes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: buildSegmentData(pipes, stripY),
    lineStyle: { color: pipeColor, width: 3 },
    itemStyle: { color: pipeColor },
    symbol: "circle",
    symbolSize: 6,
    connectNulls: false,
    tooltip: { show: false },
    z: 2,
  };
}

export function pumpValvesStripPlot(
  links: ProfileLink[],
  stripY: number,
): SeriesItem | null {
  const pumpValves = links.filter(
    (l) => l.type === "pump" || l.type === "valve",
  );
  if (pumpValves.length === 0) return null;
  const color = colors.orange700;
  return {
    type: "line" as const,
    name: "stripPumpValves",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: buildSegmentData(pumpValves, stripY),
    lineStyle: { color, width: 3 },
    itemStyle: { color },
    symbol: "circle",
    symbolSize: 6,
    connectNulls: false,
    tooltip: { show: false },
    z: 2,
  };
}

export function junctionsStripPlot(
  points: ProfilePoint[],
  nodeColor: string,
  stripY: number,
): SeriesItem | null {
  const junctions = points.filter((p) => p.nodeType === "junction");
  if (junctions.length === 0) return null;
  return {
    type: "scatter" as const,
    name: "stripNodes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: junctions.map((j) => ({
      value: [j.cumulativeLength, stripY],
      nodeId: j.nodeId,
    })),
    symbol: "circle",
    symbolSize: 7,
    itemStyle: {
      color: nodeColor,
      borderColor: NODE_BORDER_COLOR,
      borderWidth: 1,
      opacity: 1,
    },
    tooltip: { show: false },
    z: 5,
  };
}

export function tanksStripPlot(
  points: ProfilePoint[],
  stripIcons: StripPlanIcons,
  stripY: number,
): SeriesItem | null {
  const tanks = points.filter((p) => p.nodeType === "tank");
  if (tanks.length === 0) return null;
  const tankUrl = stripIcons.iconUrl("tank");
  return {
    type: "scatter" as const,
    name: "stripNodes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: tanks.map((t) => ({
      value: [t.cumulativeLength, stripY],
      nodeId: t.nodeId,
      symbol: tankUrl ? `image://${tankUrl}` : "rect",
    })),
    symbolSize: 18,
    itemStyle: { opacity: 1 },
    tooltip: { show: false },
    z: 5,
  };
}

export function reservoirsStripPlot(
  points: ProfilePoint[],
  stripIcons: StripPlanIcons,
  stripY: number,
): SeriesItem | null {
  const reservoirs = points.filter((p) => p.nodeType === "reservoir");
  if (reservoirs.length === 0) return null;
  const reservoirUrl = stripIcons.iconUrl("reservoir");
  return {
    type: "scatter" as const,
    name: "stripNodes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: reservoirs.map((r) => ({
      value: [r.cumulativeLength, stripY],
      nodeId: r.nodeId,
      symbol: reservoirUrl ? `image://${reservoirUrl}` : "diamond",
    })),
    symbolSize: 18,
    itemStyle: { opacity: 1 },
    tooltip: { show: false },
    z: 5,
  };
}

export function pumpsStripPlot(
  links: ProfileLink[],
  stripIcons: StripPlanIcons,
  stripY: number,
): SeriesItem | null {
  const pumps = links.filter((l) => l.type === "pump");
  if (pumps.length === 0) return null;
  return {
    type: "scatter" as const,
    name: "stripPumpIcons",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: pumps.map((p) => ({
      value: [p.midLength, stripY],
      linkId: p.linkId,
      symbol:
        stripIcons.pumpUrl(p) !== null
          ? `image://${stripIcons.pumpUrl(p)!}`
          : "circle",
      symbolRotate: p.reversed ? 90 : -90,
    })),
    symbolSize: 18,
    itemStyle: { opacity: 1 },
    tooltip: { show: false },
    z: 10,
  };
}

export function valvesStripPlot(
  links: ProfileLink[],
  stripIcons: StripPlanIcons,
  stripY: number,
): SeriesItem | null {
  const valves = links.filter((l) => l.type === "valve");
  if (valves.length === 0) return null;
  return {
    type: "scatter" as const,
    name: "stripValveIcons",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: valves.map((v) => ({
      value: [v.midLength, stripY],
      linkId: v.linkId,
      symbol:
        stripIcons.valveUrl(v) !== null
          ? `image://${stripIcons.valveUrl(v)!}`
          : "circle",
      symbolRotate: v.reversed ? 90 : -90,
    })),
    symbolSize: 18,
    itemStyle: { opacity: 1 },
    tooltip: { show: false },
    z: 10,
  };
}

function buildSegmentData(segments: ProfileLink[], stripY: number) {
  const data: any[] = [];
  for (const seg of segments) {
    data.push({ value: [seg.startLength, stripY], linkId: seg.linkId });
    data.push({ value: [seg.endLength, stripY], linkId: seg.linkId });
    data.push(null);
  }
  return data;
}
