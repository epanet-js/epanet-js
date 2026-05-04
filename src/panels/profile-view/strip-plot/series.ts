import type { SeriesOption } from "echarts";
import { colors } from "src/lib/constants";
import { traceDuration } from "src/infra/with-instrumentation";
import { ProfileLink, ProfilePoint } from "../chart-data";
import type { StripPlanIcons } from "./use-strip-plan-icons";

const NODE_BORDER_COLOR = "#98abeb";

const PIPE_STRIP_HALF_HEIGHT = 1.5;
const PIPE_STRIP_HIT_HALF_HEIGHT = 12;
const NODE_STRIP_HIT_HALF_WIDTH = 10;
const NODE_STRIP_HIT_HALF_HEIGHT = 12;

export type BuildStripSeriesParams = {
  points: ProfilePoint[];
  links: ProfileLink[];
  stripY: number;
  pipeColor: string;
  nodeColor: string;
  stripIcons: StripPlanIcons;
};

export function buildStripSeries({
  points,
  links,
  stripY,
  pipeColor,
  nodeColor,
  stripIcons,
}: BuildStripSeriesParams): SeriesOption[] {
  return traceDuration("DEBUG PROFILE_CHART:stripSeries", () => {
    if (links.length === 0) return [];
    return [
      pipesStripPlot(links, pipeColor, stripY),
      pumpValvesStripPlot(links, stripY),
      junctionsStripPlot(points, nodeColor, stripY),
      tanksStripPlot(points, stripIcons, stripY),
      reservoirsStripPlot(points, stripIcons, stripY),
      pumpsStripPlot(links, stripIcons, stripY),
      valvesStripPlot(links, stripIcons, stripY),
      nodesHitStripPlot(points, stripY),
    ].filter(notNull);
  });
}

function pipesStripPlot(
  links: ProfileLink[],
  pipeColor: string,
  stripY: number,
): SeriesOption | null {
  const pipes = links.filter((l) => l.type === "pipe");
  if (pipes.length === 0) return null;
  return {
    type: "custom" as const,
    name: "stripPipes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: pipes.map((p) => ({
      value: [p.startLength, stripY],
      linkId: p.linkId,
    })),
    tooltip: { show: false },
    z: 2,
    /* eslint-disable @typescript-eslint/no-explicit-any,
       @typescript-eslint/no-unsafe-assignment,
       @typescript-eslint/no-unsafe-call,
       @typescript-eslint/no-unsafe-member-access,
       @typescript-eslint/no-unsafe-return */
    renderItem: (params: any, api: any) => {
      const pipe = pipes[params.dataIndex];
      if (!pipe) return null;
      const start = api.coord([pipe.startLength, stripY]);
      const end = api.coord([pipe.endLength, stripY]);
      const width = end[0] - start[0];
      return {
        type: "group" as const,
        children: [
          {
            type: "rect" as const,
            shape: {
              x: start[0],
              y: start[1] - PIPE_STRIP_HIT_HALF_HEIGHT,
              width,
              height: PIPE_STRIP_HIT_HALF_HEIGHT * 2,
            },
            style: { fill: "transparent" },
            cursor: "pointer",
          },
          {
            type: "rect" as const,
            shape: {
              x: start[0],
              y: start[1] - PIPE_STRIP_HALF_HEIGHT,
              width,
              height: PIPE_STRIP_HALF_HEIGHT * 2,
            },
            style: { fill: pipeColor },
            silent: true,
          },
        ],
      };
    },
    /* eslint-enable */
  };
}

function pumpValvesStripPlot(
  links: ProfileLink[],
  stripY: number,
): SeriesOption | null {
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

function junctionsStripPlot(
  points: ProfilePoint[],
  nodeColor: string,
  stripY: number,
): SeriesOption | null {
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

function tanksStripPlot(
  points: ProfilePoint[],
  stripIcons: StripPlanIcons,
  stripY: number,
): SeriesOption | null {
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

function reservoirsStripPlot(
  points: ProfilePoint[],
  stripIcons: StripPlanIcons,
  stripY: number,
): SeriesOption | null {
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

function pumpsStripPlot(
  links: ProfileLink[],
  stripIcons: StripPlanIcons,
  stripY: number,
): SeriesOption | null {
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

function valvesStripPlot(
  links: ProfileLink[],
  stripIcons: StripPlanIcons,
  stripY: number,
): SeriesOption | null {
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

function nodesHitStripPlot(
  points: ProfilePoint[],
  stripY: number,
): SeriesOption | null {
  if (points.length === 0) return null;
  return {
    type: "custom" as const,
    name: "stripNodes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: points.map((p) => ({
      value: [p.cumulativeLength, stripY],
      nodeId: p.nodeId,
    })),
    tooltip: { show: false },
    z: 7,
    /* eslint-disable @typescript-eslint/no-explicit-any,
       @typescript-eslint/no-unsafe-assignment,
       @typescript-eslint/no-unsafe-call,
       @typescript-eslint/no-unsafe-member-access,
       @typescript-eslint/no-unsafe-return */
    renderItem: (params: any, api: any) => {
      const node = points[params.dataIndex];
      if (!node) return null;
      const center = api.coord([node.cumulativeLength, stripY]);
      return {
        type: "rect" as const,
        shape: {
          x: center[0] - NODE_STRIP_HIT_HALF_WIDTH,
          y: center[1] - NODE_STRIP_HIT_HALF_HEIGHT,
          width: NODE_STRIP_HIT_HALF_WIDTH * 2,
          height: NODE_STRIP_HIT_HALF_HEIGHT * 2,
        },
        style: { fill: "transparent" },
        cursor: "pointer",
      };
    },
    /* eslint-enable */
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

function notNull<T>(value: T | null): value is T {
  return value !== null;
}
