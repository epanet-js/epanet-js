import type { SeriesOption } from "echarts";
import { traceDuration } from "src/infra/with-instrumentation";
import { HglBandSegment, ProfilePoint } from "../chart-data";

const HGL_COLOR = "#2563eb";
const TERRAIN_COLOR = "#c8a96e";
const ELEVATION_DROPS_COLOR = "#ada9a0";
const NODE_BORDER_COLOR = "#98abeb";

export type BuildMainPlotSeriesParams = {
  points: ProfilePoint[];
  elevationData: [number, number][];
  hglData: [number, number | null][];
  terrainData: [number, number][] | null;
  hglBandSegments: HglBandSegment[][] | null;
  hglDropsData: ([number, number] | null)[];
  hasSimulation: boolean;
  yAxisMin: number;
  linkColor: string;
  nodeColor: string;
  elevationLabel: string;
  hglLabel: string;
};

export function buildMainPlotSeries({
  points,
  elevationData,
  hglData,
  terrainData,
  hglBandSegments,
  hglDropsData,
  hasSimulation,
  yAxisMin,
  linkColor,
  nodeColor,
  elevationLabel,
  hglLabel,
}: BuildMainPlotSeriesParams): SeriesOption[] {
  return traceDuration("DEBUG PROFILE_CHART:mainPlotSeries", () => {
    const elevDropsData = buildElevDropsData(points, yAxisMin);
    return [
      terrainAreaPlot(terrainData),
      hglBandPlot(hglBandSegments),
      elevationDropsPlot(elevDropsData),
      elevationLinePlot(elevationData, linkColor, nodeColor, elevationLabel),
      hasSimulation ? hglDropsPlot(hglDropsData) : null,
      hasSimulation ? hglLinePlot(hglData, hglLabel) : null,
    ].filter(notNull);
  });
}

function buildElevDropsData(
  points: ProfilePoint[],
  yAxisMin: number,
): ([number, number] | null)[] {
  const result: ([number, number] | null)[] = [];
  points.forEach((p) => {
    result.push([p.cumulativeLength, p.elevation]);
    result.push([p.cumulativeLength, yAxisMin]);
    result.push(null);
  });
  return result;
}

function terrainAreaPlot(
  terrainData: [number, number][] | null,
): SeriesOption | null {
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

function hglBandPlot(
  hglBandSegments: HglBandSegment[][] | null,
): SeriesOption | null {
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

function elevationDropsPlot(
  elevDropsData: ([number, number] | null)[],
): SeriesOption {
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

function elevationLinePlot(
  elevationData: [number, number][],
  lineColor: string,
  nodeColor: string,
  label: string,
): SeriesOption {
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

function hglDropsPlot(hglDropsData: ([number, number] | null)[]): SeriesOption {
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

function hglLinePlot(
  hglData: [number, number | null][],
  label: string,
): SeriesOption {
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

function notNull<T>(value: T | null): value is T {
  return value !== null;
}
