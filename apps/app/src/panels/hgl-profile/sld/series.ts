import type { SeriesOption } from "echarts";
import { colors } from "src/lib/constants";
import { strokeColorFor } from "src/lib/color";
import { traceDuration } from "src/infra/with-instrumentation";
import { ProfileLink, ProfilePoint } from "../chart-data";
import type { SldIcons } from "./use-sld-icons";
import type { SldVisibility } from "./visibility";

const NODE_BORDER_COLOR = "#98abeb";

const SELECTION_COLOR = colors.fuchsia500;
const SELECTION_STROKE_COLOR = strokeColorFor(SELECTION_COLOR);

const PIPE_SLD_HALF_HEIGHT = 1.5;

const EMPTY_SELECTION: ReadonlySet<number> = new Set();

const DEFAULT_VISIBILITY: SldVisibility = {
  showJunctions: true,
  showOtherValves: true,
};

export type BuildSldSeriesParams = {
  points: ProfilePoint[];
  links: ProfileLink[];
  sldY: number;
  pipeColor: string;
  nodeColor: string;
  sldIcons: SldIcons;
  selectedIds?: ReadonlySet<number>;
  visibility?: SldVisibility;
};

export function buildSldSeries({
  points,
  links,
  sldY,
  pipeColor,
  nodeColor,
  sldIcons,
  selectedIds = EMPTY_SELECTION,
  visibility = DEFAULT_VISIBILITY,
}: BuildSldSeriesParams): SeriesOption[] {
  return traceDuration("DEBUG PROFILE_CHART:sldSeries", () => {
    if (links.length === 0) return [];
    return [
      pipesSld(links, pipeColor, sldY, selectedIds),
      ...pumpValvesSld(links, sldY),
      pumpValveSelectionHalo(links, sldY, selectedIds, visibility),
      visibility.showJunctions
        ? junctionsSld(points, nodeColor, sldY, selectedIds)
        : null,
      visibility.showOtherValves ? otherValvesSld(links, sldIcons, sldY) : null,
      pumpsSld(links, sldIcons, sldY),
      prvValvesSld(links, sldIcons, sldY),
      reservoirsSld(points, sldIcons, sldY, selectedIds),
      tanksSld(points, sldIcons, sldY, selectedIds),
    ].filter(notNull);
  });
}

function pipesSld(
  links: ProfileLink[],
  pipeColor: string,
  sldY: number,
  selectedIds: ReadonlySet<number>,
): SeriesOption | null {
  const pipes = links.filter((l) => l.type === "pipe");
  if (pipes.length === 0) return null;
  return {
    type: "custom" as const,
    name: "sldPipes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    clip: true,
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
      const fill = selectedIds.has(pipe.linkId) ? SELECTION_COLOR : pipeColor;
      return {
        type: "rect" as const,
        shape: {
          x: start[0],
          y: start[1] - PIPE_SLD_HALF_HEIGHT,
          width,
          height: PIPE_SLD_HALF_HEIGHT * 2,
        },
        style: { fill },
      };
    },
    /* eslint-enable */
  };
}

function pumpValvesSld(links: ProfileLink[], sldY: number): SeriesOption[] {
  const pumpValves = links.filter(
    (l) => l.type === "pump" || l.type === "valve",
  );
  if (pumpValves.length === 0) return [];
  return [buildPumpValveLineSeries(pumpValves, sldY)];
}

function buildPumpValveLineSeries(
  segments: ProfileLink[],
  sldY: number,
): SeriesOption {
  return {
    type: "line" as const,
    name: "sldPumpValves",
    xAxisIndex: 1,
    yAxisIndex: 1,
    clip: true,
    data: buildSegmentData(segments, sldY),
    lineStyle: { color: colors.orange700, width: 1 },
    itemStyle: { color: colors.orange700 },
    symbol: "circle",
    symbolSize: 4,
    connectNulls: false,
    tooltip: { show: false },
    z: 2,
  };
}

function junctionsSld(
  points: ProfilePoint[],
  nodeColor: string,
  sldY: number,
  selectedIds: ReadonlySet<number>,
): SeriesOption | null {
  const junctions = points.filter((p) => p.nodeType === "junction");
  if (junctions.length === 0) return null;
  return {
    type: "scatter" as const,
    name: "sldNodes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    clip: true,
    data: junctions.map((j) => ({
      value: [j.cumulativeLength, sldY],
      nodeId: j.nodeId,
      itemStyle: selectedIds.has(j.nodeId)
        ? {
            color: SELECTION_COLOR,
            borderColor: SELECTION_STROKE_COLOR,
            borderWidth: 1,
            opacity: 1,
          }
        : undefined,
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
  selectedIds: ReadonlySet<number>,
): SeriesOption | null {
  const tanks = points.filter((p) => p.nodeType === "tank");
  if (tanks.length === 0) return null;
  const tankUrl = sldIcons.iconUrl("tank");
  const tankSelectedUrl = sldIcons.iconUrl("tank-selected");
  return {
    type: "scatter" as const,
    name: "sldNodes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    clip: true,
    data: tanks.map((t) => ({
      value: [t.cumulativeLength, sldY],
      nodeId: t.nodeId,
      symbol: pickIconSymbol(
        selectedIds.has(t.nodeId) ? tankSelectedUrl : tankUrl,
        "rect",
      ),
    })),
    symbolSize: 18,
    itemStyle: { opacity: 1 },
    tooltip: { show: false },
    zlevel: 1,
    z: 13,
  };
}

function reservoirsSld(
  points: ProfilePoint[],
  sldIcons: SldIcons,
  sldY: number,
  selectedIds: ReadonlySet<number>,
): SeriesOption | null {
  const reservoirs = points.filter((p) => p.nodeType === "reservoir");
  if (reservoirs.length === 0) return null;
  const reservoirUrl = sldIcons.iconUrl("reservoir");
  const reservoirSelectedUrl = sldIcons.iconUrl("reservoir-selected");
  return {
    type: "scatter" as const,
    name: "sldNodes",
    xAxisIndex: 1,
    yAxisIndex: 1,
    clip: true,
    data: reservoirs.map((r) => ({
      value: [r.cumulativeLength, sldY],
      nodeId: r.nodeId,
      symbol: pickIconSymbol(
        selectedIds.has(r.nodeId) ? reservoirSelectedUrl : reservoirUrl,
        "diamond",
      ),
    })),
    symbolSize: 18,
    itemStyle: { opacity: 1 },
    tooltip: { show: false },
    zlevel: 1,
    z: 13,
  };
}

function pickIconSymbol(url: string | null, fallback: string): string {
  return url ? `image://${url}` : fallback;
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
    clip: true,
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
    zlevel: 1,
    z: 12,
  };
}

function prvValvesSld(
  links: ProfileLink[],
  sldIcons: SldIcons,
  sldY: number,
): SeriesOption | null {
  const prvs = links.filter((l) => l.type === "valve" && l.valveKind === "prv");
  if (prvs.length === 0) return null;
  return buildValveScatter(prvs, sldIcons, sldY, 1, 12);
}

function otherValvesSld(
  links: ProfileLink[],
  sldIcons: SldIcons,
  sldY: number,
): SeriesOption | null {
  const others = links.filter(
    (l) => l.type === "valve" && l.valveKind !== "prv",
  );
  if (others.length === 0) return null;
  return buildValveScatter(others, sldIcons, sldY, 0, 7);
}

function buildValveScatter(
  valves: ProfileLink[],
  sldIcons: SldIcons,
  sldY: number,
  zlevel: number,
  z: number,
): SeriesOption {
  return {
    type: "scatter" as const,
    name: "sldValveIcons",
    xAxisIndex: 1,
    yAxisIndex: 1,
    clip: true,
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
    zlevel,
    z,
  };
}

function pumpValveSelectionHalo(
  links: ProfileLink[],
  sldY: number,
  selectedIds: ReadonlySet<number>,
  visibility: SldVisibility,
): SeriesOption | null {
  const selected = links.filter((l) => {
    if (!selectedIds.has(l.linkId)) return false;
    if (l.type === "pump") return true;
    if (l.type !== "valve") return false;
    if (l.valveKind === "prv") return true;
    return visibility.showOtherValves;
  });
  if (selected.length === 0) return null;
  return {
    type: "scatter" as const,
    name: "sldPumpValveSelectionHalo",
    xAxisIndex: 1,
    yAxisIndex: 1,
    clip: true,
    data: selected.map((l) => ({
      value: [l.midLength, sldY],
      linkId: l.linkId,
    })),
    symbol: "circle",
    symbolSize: 24,
    itemStyle: { color: SELECTION_COLOR, opacity: 0.8 },
    silent: true,
    tooltip: { show: false },
    z: 6,
  };
}

type LineSegmentDatum = { value: [number, number]; linkId: number } | null;

function buildSegmentData(
  segments: ProfileLink[],
  sldY: number,
): LineSegmentDatum[] {
  const data: LineSegmentDatum[] = [];
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
