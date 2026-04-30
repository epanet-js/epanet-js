import type { SeriesOption } from "echarts";
import { colors } from "src/lib/constants";
import { HglBandSegment, ProfileLink, ProfilePoint } from "./chart-data";
import type { StripPlanIcons } from "./use-strip-plan-icons";

type SeriesItem = SeriesOption;

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
