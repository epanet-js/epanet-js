import type { SeriesOption } from "echarts";
import { colors } from "src/lib/constants";
import { traceDuration } from "src/infra/with-instrumentation";
import { ProfileLink, ProfilePoint } from "../chart-data";
import type { SldIcons } from "./use-sld-icons";

const NODE_BORDER_COLOR = "#98abeb";

const PIPE_SLD_HALF_HEIGHT = 1.5;

export type BuildSldSeriesParams = {
  points: ProfilePoint[];
  links: ProfileLink[];
  sldY: number;
  pipeColor: string;
  nodeColor: string;
  sldIcons: SldIcons;
};

export function buildSldSeries({
  points,
  links,
  sldY,
  pipeColor,
  nodeColor,
  sldIcons,
}: BuildSldSeriesParams): SeriesOption[] {
  return traceDuration("DEBUG PROFILE_CHART:sldSeries", () => {
    if (links.length === 0) return [];
    return [
      pipesSld(links, pipeColor, sldY),
      pumpValvesSld(links, sldY),
      junctionsSld(points, nodeColor, sldY),
      tanksSld(points, sldIcons, sldY),
      reservoirsSld(points, sldIcons, sldY),
      pumpsSld(links, sldIcons, sldY),
      valvesSld(links, sldIcons, sldY),
    ].filter(notNull);
  });
}

function pipesSld(
  links: ProfileLink[],
  pipeColor: string,
  sldY: number,
): SeriesOption | null {
  const pipes = links.filter((l) => l.type === "pipe");
  if (pipes.length === 0) return null;
  return {
    type: "custom" as const,
    name: "sldPipes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: pipes.map((p) => p.startLength),
    silent: true,
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
      const start = api.coord([pipe.startLength, sldY]);
      const end = api.coord([pipe.endLength, sldY]);
      const width = end[0] - start[0];
      return {
        type: "rect" as const,
        shape: {
          x: start[0],
          y: start[1] - PIPE_SLD_HALF_HEIGHT,
          width,
          height: PIPE_SLD_HALF_HEIGHT * 2,
        },
        style: { fill: pipeColor },
      };
    },
    /* eslint-enable */
  };
}

function pumpValvesSld(
  links: ProfileLink[],
  sldY: number,
): SeriesOption | null {
  const pumpValves = links.filter(
    (l) => l.type === "pump" || l.type === "valve",
  );
  if (pumpValves.length === 0) return null;
  const color = colors.orange700;
  return {
    type: "line" as const,
    name: "sldPumpValves",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: buildSegmentData(pumpValves, sldY),
    lineStyle: { color, width: 3 },
    itemStyle: { color },
    symbol: "circle",
    symbolSize: 6,
    connectNulls: false,
    tooltip: { show: false },
    z: 2,
  };
}

function junctionsSld(
  points: ProfilePoint[],
  nodeColor: string,
  sldY: number,
): SeriesOption | null {
  const junctions = points.filter((p) => p.nodeType === "junction");
  if (junctions.length === 0) return null;
  return {
    type: "scatter" as const,
    name: "sldNodes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: junctions.map((j) => ({
      value: [j.cumulativeLength, sldY],
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

function tanksSld(
  points: ProfilePoint[],
  sldIcons: SldIcons,
  sldY: number,
): SeriesOption | null {
  const tanks = points.filter((p) => p.nodeType === "tank");
  if (tanks.length === 0) return null;
  const tankUrl = sldIcons.iconUrl("tank");
  return {
    type: "scatter" as const,
    name: "sldNodes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: tanks.map((t) => ({
      value: [t.cumulativeLength, sldY],
      nodeId: t.nodeId,
      symbol: tankUrl ? `image://${tankUrl}` : "rect",
    })),
    symbolSize: 18,
    itemStyle: { opacity: 1 },
    tooltip: { show: false },
    z: 5,
  };
}

function reservoirsSld(
  points: ProfilePoint[],
  sldIcons: SldIcons,
  sldY: number,
): SeriesOption | null {
  const reservoirs = points.filter((p) => p.nodeType === "reservoir");
  if (reservoirs.length === 0) return null;
  const reservoirUrl = sldIcons.iconUrl("reservoir");
  return {
    type: "scatter" as const,
    name: "sldNodes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: reservoirs.map((r) => ({
      value: [r.cumulativeLength, sldY],
      nodeId: r.nodeId,
      symbol: reservoirUrl ? `image://${reservoirUrl}` : "diamond",
    })),
    symbolSize: 18,
    itemStyle: { opacity: 1 },
    tooltip: { show: false },
    z: 5,
  };
}

function pumpsSld(
  links: ProfileLink[],
  sldIcons: SldIcons,
  sldY: number,
): SeriesOption | null {
  const pumps = links.filter((l) => l.type === "pump");
  if (pumps.length === 0) return null;
  return {
    type: "scatter" as const,
    name: "sldPumpIcons",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: pumps.map((p) => ({
      value: [p.midLength, sldY],
      linkId: p.linkId,
      symbol:
        sldIcons.pumpUrl(p) !== null
          ? `image://${sldIcons.pumpUrl(p)!}`
          : "circle",
      symbolRotate: p.reversed ? 90 : -90,
    })),
    symbolSize: 18,
    itemStyle: { opacity: 1 },
    tooltip: { show: false },
    z: 10,
  };
}

function valvesSld(
  links: ProfileLink[],
  sldIcons: SldIcons,
  sldY: number,
): SeriesOption | null {
  const valves = links.filter((l) => l.type === "valve");
  if (valves.length === 0) return null;
  return {
    type: "scatter" as const,
    name: "sldValveIcons",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: valves.map((v) => ({
      value: [v.midLength, sldY],
      linkId: v.linkId,
      symbol:
        sldIcons.valveUrl(v) !== null
          ? `image://${sldIcons.valveUrl(v)!}`
          : "circle",
      symbolRotate: v.reversed ? 90 : -90,
    })),
    symbolSize: 18,
    itemStyle: { opacity: 1 },
    tooltip: { show: false },
    z: 10,
  };
}

function buildSegmentData(segments: ProfileLink[], sldY: number) {
  const data: any[] = [];
  for (const seg of segments) {
    data.push({ value: [seg.startLength, sldY], linkId: seg.linkId });
    data.push({ value: [seg.endLength, sldY], linkId: seg.linkId });
    data.push(null);
  }
  return data;
}

function notNull<T>(value: T | null): value is T {
  return value !== null;
}
