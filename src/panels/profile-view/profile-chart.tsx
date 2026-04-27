"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useSetAtom } from "jotai";
import {
  ProfileLink,
  ProfilePoint,
  useTerrainSamples,
} from "./use-profile-data";
import { HglRange } from "./use-profile-hgl-range";
import {
  useTerrainElevations,
  type TerrainPoint,
} from "./use-terrain-elevations";
import { useStripPlanIcons } from "./use-strip-plan-icons";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { selectionAtom } from "src/state/selection";
import { tabAtom, TabOption } from "src/state/layout";
import { linkSymbologyAtom, nodeSymbologyAtom } from "src/state/map-symbology";
import { useAtomValue } from "jotai";
import { colors } from "src/lib/constants";
import { USelection } from "src/selection/selection";

const STRIP_GRID_TOP = 6;
const STRIP_GRID_HEIGHT = 30;
const STRIP_PROFILE_GAP = 2;
const SNAP_PIXEL_THRESHOLD = 20;

function findLinkAt(
  x: number,
  links: ProfileLink[] | null,
): ProfileLink | null {
  if (!links) return null;
  for (const link of links) {
    if (x >= link.startLength && x <= link.endLength) return link;
  }
  return null;
}

function interpolateTerrain(
  x: number,
  terrain: TerrainPoint[] | null,
): number | null {
  if (!terrain || terrain.length === 0) return null;
  if (x <= terrain[0].cumulativeLength) return terrain[0].elevation;
  const last = terrain[terrain.length - 1];
  if (x >= last.cumulativeLength) return last.elevation;
  for (let i = 0; i < terrain.length - 1; i++) {
    const a = terrain[i];
    const b = terrain[i + 1];
    if (x >= a.cumulativeLength && x <= b.cumulativeLength) {
      const span = b.cumulativeLength - a.cumulativeLength;
      if (span <= 0) return a.elevation;
      const t = (x - a.cumulativeLength) / span;
      return a.elevation + (b.elevation - a.elevation) * t;
    }
  }
  return null;
}

function interpolateHgl(x: number, points: ProfilePoint[]): number | null {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (x >= a.cumulativeLength && x <= b.cumulativeLength) {
      if (a.head === null || b.head === null) return null;
      const span = b.cumulativeLength - a.cumulativeLength;
      if (span <= 0) return a.head;
      const t = (x - a.cumulativeLength) / span;
      return a.head + (b.head - a.head) * t;
    }
  }
  return null;
}

function computePressureFactor(points: ProfilePoint[]): number | null {
  for (const p of points) {
    if (p.pressure === null || p.head === null) continue;
    const headDiff = p.head - p.elevation;
    if (Math.abs(headDiff) > 1e-6) return p.pressure / headDiff;
  }
  return null;
}

type TooltipDeps = {
  points: ProfilePoint[];
  links: ProfileLink[] | null;
  terrain: TerrainPoint[] | null;
  pressureFactor: number | null;
  elevColor: string;
  translate: (key: string) => string;
};

function buildTooltipHtml(
  cursorX: number,
  snappedIdx: number | null,
  deps: TooltipDeps,
): string {
  const { points, links, terrain, pressureFactor, elevColor, translate } = deps;
  const hglColor = "#2563eb";
  const dot = (color: string) =>
    `<span style="display:inline-block;width:8px;height:8px;background:${color};margin-right:4px;border-radius:50%;"></span>`;
  const spacer = `<span style="display:inline-block;width:8px;height:8px;margin-right:4px;"></span>`;
  const fmt = (v: number) => localizeDecimal(v, { decimals: 2 });

  if (snappedIdx !== null) {
    const nearest = points[snappedIdx];
    const lines: string[] = [];
    lines.push(
      `${dot(elevColor)}${translate("profileView.elevation")}: ${fmt(nearest.elevation)}`,
    );
    if (nearest.head !== null) {
      lines.push(
        `${dot(hglColor)}${translate("profileView.hgl")}: ${fmt(nearest.head)}`,
      );
    }
    if (nearest.pressure !== null) {
      lines.push(`${spacer}${translate("pressure")}: ${fmt(nearest.pressure)}`);
    }
    return `<strong>${nearest.label}</strong><br/>${lines.join("<br/>")}`;
  }

  const link = findLinkAt(cursorX, links);
  if (link?.type === "pump" || link?.type === "valve") return "";

  const elev = interpolateTerrain(cursorX, terrain);
  const hgl = interpolateHgl(cursorX, points);
  const pressure =
    hgl !== null && elev !== null && pressureFactor !== null
      ? pressureFactor * (hgl - elev)
      : null;

  const lines: string[] = [];
  if (elev !== null) {
    lines.push(
      `${dot(elevColor)}${translate("profileView.elevation")}: ${fmt(elev)}`,
    );
  }
  if (hgl !== null) {
    lines.push(`${dot(hglColor)}${translate("profileView.hgl")}: ${fmt(hgl)}`);
  }
  if (pressure !== null) {
    lines.push(`${spacer}${translate("pressure")}: ${fmt(pressure)}`);
  }
  if (lines.length === 0) return "";

  const estimatedTag = `<em style="opacity:0.7;font-style:italic;">(${translate("profileView.estimated")})</em>`;
  const header = link
    ? `<strong>${link.label}</strong> ${estimatedTag}`
    : `<strong>${translate("profileView.estimated")}</strong>`;
  return `${header}<br/>${lines.join("<br/>")}`;
}

interface ProfileChartProps {
  points: ProfilePoint[];
  links: ProfileLink[] | null;
  hglRanges: (HglRange | null)[] | null;
}

export const ProfileChart = memo(function ProfileChart({
  points,
  links,
  hglRanges,
}: ProfileChartProps) {
  const translate = useTranslate();
  const setSelection = useSetAtom(selectionAtom);
  const setTab = useSetAtom(tabAtom);
  const linkSymbology = useAtomValue(linkSymbologyAtom);
  const nodeSymbology = useAtomValue(nodeSymbologyAtom);
  const stripIcons = useStripPlanIcons();

  const onChartClick = useCallback(
    (params: any) => {
      const seriesName: string | undefined = params?.seriesName;
      const data = params?.data;

      if (typeof seriesName === "string" && seriesName.startsWith("strip")) {
        const linkId: number | undefined = data?.linkId;
        const nodeId: number | undefined = data?.nodeId;
        const assetId = linkId ?? nodeId;
        if (typeof assetId !== "number") return;
        setSelection(USelection.single(assetId));
        setTab(TabOption.Asset);
        return;
      }

      const idx: number | undefined = params?.dataIndex;
      if (typeof idx !== "number") return;
      const point = points[idx];
      if (!point) return;
      setSelection(USelection.single(point.nodeId));
      setTab(TabOption.Asset);
    },
    [points, setSelection, setTab],
  );

  const terrainSamples = useTerrainSamples();
  const terrain = useTerrainElevations(terrainSamples);
  const hasSimulation = points.some(
    (p) => p.head !== null || p.pressure !== null,
  );

  const elevationData = useMemo(
    () => points.map((p) => [p.cumulativeLength, p.elevation]),
    [points],
  );
  const hglData = useMemo(
    () => points.map((p) => [p.cumulativeLength, p.head]),
    [points],
  );
  const terrainData = useMemo(
    () =>
      terrain ? terrain.map((t) => [t.cumulativeLength, t.elevation]) : null,
    [terrain],
  );

  // Group contiguous nodes that have valid min/max head into segments,
  // each rendered as a single polygon by the custom band series.
  const hglBandSegments = useMemo(() => {
    if (!hglRanges || hglRanges.length !== points.length) return null;
    const segments: Array<Array<{ x: number; min: number; max: number }>> = [];
    let current: Array<{ x: number; min: number; max: number }> | null = null;
    for (let i = 0; i < points.length; i++) {
      const r = hglRanges[i];
      if (r) {
        if (!current) current = [];
        current.push({
          x: points[i].cumulativeLength,
          min: r.minHead,
          max: r.maxHead,
        });
      } else {
        if (current && current.length >= 2) segments.push(current);
        current = null;
      }
    }
    if (current && current.length >= 2) segments.push(current);
    return segments.length > 0 ? segments : null;
  }, [points, hglRanges]);

  // Compute Y axis range for exactly 10 evenly spaced tick values
  const yAxisRange = useMemo(() => {
    const vals: number[] = [];
    points.forEach((p, i) => {
      vals.push(p.elevation);
      if (p.head !== null) vals.push(p.head);
      const r = hglRanges?.[i];
      if (r) {
        vals.push(r.minHead);
        vals.push(r.maxHead);
      }
    });
    if (terrainData) {
      terrainData.forEach(([, v]) => {
        if (v !== null && v !== undefined) vals.push(v);
      });
    }
    if (vals.length === 0) return { min: 0, max: 100, interval: 100 / 9 };
    const dataMin = Math.min(...vals);
    const dataMax = Math.max(...vals);
    const span = dataMax - dataMin || 10;
    const padding = span * 0.08;
    const yMin = dataMin - padding;
    const yMax = dataMax + padding;
    return { min: yMin, max: yMax, interval: (yMax - yMin) / 9 };
  }, [points, terrainData, hglRanges]);

  // Blue vertical drops: HGL down to node elevation
  const hglDropsData = useMemo(() => {
    if (!hasSimulation) return [];
    const result: (number[] | null)[] = [];
    points.forEach((p) => {
      if (p.head !== null) {
        result.push([p.cumulativeLength, p.head]);
        result.push([p.cumulativeLength, p.elevation]);
        result.push(null);
      }
    });
    return result;
  }, [points, hasSimulation]);

  // Light brown vertical drops: node elevation down to X axis
  const elevDropsData = useMemo(() => {
    const result: (number[] | null)[] = [];
    points.forEach((p) => {
      result.push([p.cumulativeLength, p.elevation]);
      result.push([p.cumulativeLength, yAxisRange.min]);
      result.push(null);
    });
    return result;
  }, [points, yAxisRange.min]);

  const series: EChartsOption["series"] = useMemo(() => {
    const terrainSeries = terrainData
      ? [
          {
            type: "line" as const,
            name: "terrain",
            data: terrainData,
            lineStyle: { opacity: 0, width: 0 },
            itemStyle: { opacity: 0 },
            areaStyle: { color: "#c8a96e", opacity: 0.22 },
            symbol: "none",
            smooth: false,
            silent: true,
            showInLegend: false,
            tooltip: { show: false },
          },
        ]
      : [];

    const hglBandSeries = hglBandSegments
      ? [
          {
            type: "custom" as const,
            name: "hglBand",
            data: hglBandSegments,
            silent: true,
            showInLegend: false,
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
                style: { fill: "#2563eb", opacity: 0.12 },
                silent: true,
              };
            },
            /* eslint-enable */
          },
        ]
      : [];

    const elevDropsSeries = {
      type: "line" as const,
      name: "elevDrops",
      data: elevDropsData,
      lineStyle: { color: "#ada9a0", width: 1 },
      itemStyle: { opacity: 0 },
      symbol: "none",
      connectNulls: false,
      silent: true,
      showInLegend: false,
      tooltip: { show: false },
    };

    const base = [
      ...terrainSeries,
      ...hglBandSeries,
      elevDropsSeries,
      {
        type: "line" as const,
        name: translate("profileView.elevation"),
        data: elevationData,
        lineStyle: { color: linkSymbology.defaults.color, width: 1.75 },
        itemStyle: {
          color: nodeSymbology.defaults.color,
          borderColor: "#98abeb",
          borderWidth: 0.75,
        },
        symbol: "circle",
        symbolSize: 5,
        smooth: false,
      },
    ];

    if (!hasSimulation) return base;

    const hglDropsSeries = {
      type: "line" as const,
      name: "hglDrops",
      data: hglDropsData,
      lineStyle: { color: "#2563eb", width: 1.25 },
      itemStyle: { opacity: 0 },
      symbol: "none",
      connectNulls: false,
      silent: true,
      showInLegend: false,
      tooltip: { show: false },
    };

    return [
      ...base,
      hglDropsSeries,
      {
        type: "line" as const,
        name: translate("profileView.hgl"),
        data: hglData,
        lineStyle: { color: "#2563eb", width: 2 },
        itemStyle: { color: "#2563eb" },
        symbol: "circle",
        symbolSize: 0,
        smooth: false,
      },
    ];
  }, [
    translate,
    elevationData,
    hglData,
    hasSimulation,
    terrainData,
    hglDropsData,
    elevDropsData,
    hglBandSegments,
  ]);

  const nodePositions = useMemo(
    () => points.map((p) => p.cumulativeLength),
    [points],
  );

  const totalLength = nodePositions[nodePositions.length - 1] ?? 0;

  const pressureFactor = useMemo(() => computePressureFactor(points), [points]);

  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipDepsRef = useRef<TooltipDeps>({
    points,
    links,
    terrain,
    pressureFactor,
    elevColor: nodeSymbology.defaults.color,
    translate,
  });
  tooltipDepsRef.current = {
    points,
    links,
    terrain,
    pressureFactor,
    elevColor: nodeSymbology.defaults.color,
    translate,
  };

  const [tooltipState, setTooltipState] = useState<{
    px: number;
    py: number;
    html: string;
  } | null>(null);

  const onChartReady = useCallback((chart: any) => {
    chartRef.current = chart;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleMove = (e: MouseEvent) => {
      const chart = chartRef.current;
      if (!chart) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      /* eslint-disable @typescript-eslint/no-unsafe-call,
         @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-assignment */
      const result =
        chart.convertFromPixel({ gridIndex: 0 }, [px, py]) ??
        chart.convertFromPixel({ seriesIndex: 0 }, [px, py]);
      const cursorX = Array.isArray(result) ? (result[0] as number) : NaN;
      if (Number.isNaN(cursorX)) {
        chart.dispatchAction({
          type: "updateAxisPointer",
          currTrigger: "leave",
        });
        setTooltipState(null);
        return;
      }

      const deps = tooltipDepsRef.current;
      let snappedIdx: number | null = null;
      let snappedPixelX: number | null = null;
      let bestDist = SNAP_PIXEL_THRESHOLD;
      for (let i = 0; i < deps.points.length; i++) {
        const pointPx = chart.convertToPixel(
          { xAxisIndex: 0 },
          deps.points[i].cumulativeLength,
        );
        if (typeof pointPx !== "number" || Number.isNaN(pointPx)) continue;
        const d = Math.abs(pointPx - px);
        if (d <= bestDist) {
          bestDist = d;
          snappedIdx = i;
          snappedPixelX = pointPx;
        }
      }

      const effectivePixelX = snappedPixelX ?? px;
      chart.dispatchAction({
        type: "updateAxisPointer",
        currTrigger: "mousemove",
        x: effectivePixelX,
        y: py,
      });
      /* eslint-enable */

      const html = buildTooltipHtml(cursorX, snappedIdx, deps);
      if (!html) {
        setTooltipState(null);
        return;
      }
      setTooltipState({ px, py, html });
    };
    const handleLeave = () => {
      const chart = chartRef.current;
      if (chart) {
        /* eslint-disable @typescript-eslint/no-unsafe-call,
           @typescript-eslint/no-unsafe-member-access */
        chart.dispatchAction({
          type: "updateAxisPointer",
          currTrigger: "leave",
        });
        /* eslint-enable */
      }
      setTooltipState(null);
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  const stripY = (yAxisRange.min + yAxisRange.max) / 2;

  const stripSeries = useMemo<EChartsOption["series"]>(() => {
    if (!links || links.length === 0) return [];

    const pipes = links.filter((l) => l.type === "pipe");
    const pumpValves = links.filter(
      (l) => l.type === "pump" || l.type === "valve",
    );

    const buildSegmentData = (segments: ProfileLink[]) => {
      const data: any[] = [];
      for (const seg of segments) {
        data.push({
          value: [seg.startLength, stripY],
          linkId: seg.linkId,
        });
        data.push({
          value: [seg.endLength, stripY],
          linkId: seg.linkId,
        });
        data.push(null);
      }
      return data;
    };

    const pipeColor = linkSymbology.defaults.color;
    const linkActiveColor = colors.orange700;

    const series: any[] = [];

    if (pipes.length > 0) {
      series.push({
        type: "line" as const,
        name: "stripPipes",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: buildSegmentData(pipes),
        lineStyle: { color: pipeColor, width: 3 },
        itemStyle: { color: pipeColor },
        symbol: "circle",
        symbolSize: 6,
        connectNulls: false,
        showInLegend: false,
        tooltip: { show: false },
        z: 2,
      });
    }

    if (pumpValves.length > 0) {
      series.push({
        type: "line" as const,
        name: "stripPumpValves",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: buildSegmentData(pumpValves),
        lineStyle: { color: linkActiveColor, width: 3 },
        itemStyle: { color: linkActiveColor },
        symbol: "circle",
        symbolSize: 6,
        connectNulls: false,
        showInLegend: false,
        tooltip: { show: false },
        z: 2,
      });
    }

    const junctions = points.filter((p) => p.nodeType === "junction");
    if (junctions.length > 0) {
      series.push({
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
          color: nodeSymbology.defaults.color,
          borderColor: "#98abeb",
          borderWidth: 1,
          opacity: 1,
        },
        showInLegend: false,
        tooltip: { show: false },
        z: 5,
      });
    }

    const tanks = points.filter((p) => p.nodeType === "tank");
    if (tanks.length > 0) {
      const tankUrl = stripIcons.iconUrl("tank");
      series.push({
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
        showInLegend: false,
        tooltip: { show: false },
        z: 5,
      });
    }

    const reservoirs = points.filter((p) => p.nodeType === "reservoir");
    if (reservoirs.length > 0) {
      const reservoirUrl = stripIcons.iconUrl("reservoir");
      series.push({
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
        showInLegend: false,
        tooltip: { show: false },
        z: 5,
      });
    }

    const pumps = links.filter((l) => l.type === "pump");
    if (pumps.length > 0) {
      series.push({
        type: "scatter" as const,
        name: "stripPumpIcons",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: pumps.map((p) => ({
          value: [p.midLength, stripY],
          linkId: p.linkId,
          symbol:
            stripIcons.pumpUrl(p) !== null
              ? `image://${stripIcons.pumpUrl(p)}`
              : "circle",
          symbolRotate: p.reversed ? 90 : -90,
        })),
        symbolSize: 18,
        itemStyle: { opacity: 1 },
        showInLegend: false,
        tooltip: { show: false },
        z: 10,
      });
    }

    const valves = links.filter((l) => l.type === "valve");
    if (valves.length > 0) {
      series.push({
        type: "scatter" as const,
        name: "stripValveIcons",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: valves.map((v) => ({
          value: [v.midLength, stripY],
          linkId: v.linkId,
          symbol:
            stripIcons.valveUrl(v) !== null
              ? `image://${stripIcons.valveUrl(v)}`
              : "circle",
          symbolRotate: v.reversed ? 90 : -90,
        })),
        symbolSize: 18,
        itemStyle: { opacity: 1 },
        showInLegend: false,
        tooltip: { show: false },
        z: 10,
      });
    }

    return series;
  }, [
    links,
    points,
    stripY,
    linkSymbology.defaults.color,
    nodeSymbology.defaults.color,
    stripIcons,
  ]);

  const profileGridTop =
    STRIP_GRID_TOP +
    STRIP_GRID_HEIGHT +
    STRIP_PROFILE_GAP +
    (hasSimulation ? 4 : 0);

  const option: EChartsOption = useMemo(
    () => ({
      animation: false,
      grid: [
        {
          top: profileGridTop,
          right: 12,
          bottom: 12,
          left: 12,
          containLabel: true,
        },
        {
          top: STRIP_GRID_TOP,
          height: STRIP_GRID_HEIGHT,
          right: 12,
          left: 12,
          containLabel: true,
        },
      ],
      xAxis: [
        {
          type: "value",
          min: 0,
          max: totalLength,
          nameLocation: "middle",
          splitLine: { show: true, lineStyle: { color: "#e5e7eb" } },
          axisTick: { customValues: nodePositions } as any,
          axisLabel: {
            hideOverlap: true,
            customValues: nodePositions,
            formatter: (val: number) => localizeDecimal(val, { decimals: 0 }),
          } as any,
          axisPointer: {
            show: true,
            type: "line",
            snap: false,
            triggerTooltip: false,
            label: { show: false },
            lineStyle: { color: "#9ca3af", width: 1, type: "dashed" },
          } as any,
        },
        {
          gridIndex: 1,
          type: "value",
          min: 0,
          max: totalLength,
          show: false,
          axisPointer: {
            show: true,
            type: "line",
            snap: false,
            triggerTooltip: false,
            label: { show: false },
            lineStyle: { color: "#9ca3af", width: 1, type: "dashed" },
          } as any,
        },
      ],
      yAxis: [
        {
          type: "value",
          min: Math.round(yAxisRange.min),
          max: Math.round(yAxisRange.max),
          interval: Math.round(yAxisRange.interval),
          axisLabel: {
            fontSize: 12,
            formatter: (val: number) => localizeDecimal(val, { decimals: 0 }),
          },
        },
        {
          gridIndex: 1,
          type: "value",
          min: yAxisRange.min,
          max: yAxisRange.max,
          interval: yAxisRange.interval,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            fontSize: 12,
            color: "transparent",
            formatter: (val: number) => localizeDecimal(val, { decimals: 0 }),
          },
        },
      ],
      series: [...((series ?? []) as any[]), ...((stripSeries ?? []) as any[])],
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
    }),
    [
      series,
      stripSeries,
      nodePositions,
      totalLength,
      yAxisRange,
      profileGridTop,
    ],
  );

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", height: "100%", width: "100%" }}
    >
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        notMerge={true}
        onEvents={{ click: onChartClick }}
        onChartReady={onChartReady}
      />
      {tooltipState && (
        <div
          style={{
            position: "absolute",
            left: tooltipState.px + 12,
            top: tooltipState.py + 12,
            pointerEvents: "none",
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 4,
            padding: "6px 8px",
            fontSize: 12,
            lineHeight: 1.5,
            color: "#111827",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            zIndex: 1000,
            whiteSpace: "nowrap",
          }}
          dangerouslySetInnerHTML={{ __html: tooltipState.html }}
        />
      )}
    </div>
  );
});
