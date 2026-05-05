import { useEffect, useRef, useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useAtomValue } from "jotai";
import {
  simulationDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { colors } from "src/lib/constants";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { calculateInterval } from "src/panels/asset-panel/quick-graph/quick-graph-chart";
import { getDecimals } from "src/lib/project-settings";
import {
  classifyAssetTypes,
  getAvailableProperties,
  isNodeType,
} from "../property-config";
import type { AssetType } from "src/hydraulic-model/asset-types";
import type { QuickGraphAssetType } from "src/state/quick-graph";
import type { TimeSeries } from "src/simulation/epanet/eps-results-reader";
import { captureError } from "src/infra/error-tracking";

const MAX_LINES = 12;

const CHART_COLORS = [
  "#A2780B",
  "#FF4939",
  "#21A344",
  "#3D77FF",
  "#1EA347",
  "#987C0C",
  "#FF4749",
  "#6169FF",
  "#00A2B5",
  "#6D8B15",
  "#D1660C",
  "#C14FD4",
];

const EMERALD_SCALE = [
  "#022c22", // 950
  "#064e3b", // 900
  "#065f46", // 800
  "#047857", // 700
  "#059669", // 600
  "#10b981", // 500
  "#34d399", // 400
  "#6ee7b7", // 300
  "#a7f3d0", // 200
  "#d1fae5", // 100
];

const ORANGE_SCALE = [
  "#431407", // 950
  "#7c2d12", // 900
  "#9a3412", // 800
  "#c2410c", // 700
  "#ea580c", // 600
  "#f97316", // 500
  "#fb923c", // 400
  "#fdba74", // 300
  "#fed7aa", // 200
  "#ffedd5", // 100
];

function percentile(sorted: number[], pct: number): number {
  const idx = (pct / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function computePercentileSeries(
  allSeries: Float32Array[],
  timestepCount: number,
): {
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
} {
  const p10: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p90: number[] = [];

  for (let t = 0; t < timestepCount; t++) {
    const vals = allSeries.map((s) => s[t]).sort((a, b) => a - b);
    p10.push(percentile(vals, 10));
    p25.push(percentile(vals, 25));
    p50.push(percentile(vals, 50));
    p75.push(percentile(vals, 75));
    p90.push(percentile(vals, 90));
  }
  return { p10, p25, p50, p75, p90 };
}

function buildTimeLabels(count: number, intervalSeconds: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    const total = i * intervalSeconds;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    labels.push(`${h}:${m.toString().padStart(2, "0")}`);
  }
  return labels;
}

function buildXAxis(
  count: number,
  intervalSeconds: number,
): EChartsOption["xAxis"] {
  return {
    type: "category",
    data: buildTimeLabels(count, intervalSeconds),
    boundaryGap: false,
    splitLine: {
      show: true,
      lineStyle: { color: colors.gray300, type: "dashed" as const },
    },
    axisTick: { show: true, lineStyle: { color: colors.gray300 } },
    axisLabel: { color: colors.gray500, fontSize: 12 },
    axisLine: { show: true, lineStyle: { color: colors.gray300 } },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildYAxisConfig(values: number[], decimals: number, name = ""): any {
  const { min, max, interval } = calculateInterval(decimals, values, 5);
  return {
    type: "value",
    name,
    nameLocation: "end",
    nameTextStyle: { color: colors.gray500, fontSize: 11, align: "left" },
    min,
    max,
    interval,
    splitLine: {
      show: true,
      lineStyle: { color: colors.gray300, type: "dashed" },
    },
    axisLine: { show: true, lineStyle: { color: colors.gray300 } },
    axisTick: { show: true, lineStyle: { color: colors.gray300 } },
    axisLabel: {
      color: colors.gray500,
      fontSize: 12,
      formatter: (v: number) => localizeDecimal(v, { decimals }),
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildLineSeries(
  label: string,
  data: number[],
  color: string,
  yAxisIndex = 0,
  dashed = false,
): any {
  return {
    type: "line",
    name: label,
    data,
    yAxisIndex,
    lineStyle: {
      color,
      width: 2,
      ...(dashed ? { type: "dashed" as const } : {}),
    },
    itemStyle: { color },
    symbol: "none",
    smooth: false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPercentileSeries(
  percs: ReturnType<typeof computePercentileSeries>,
  baseColor: string,
  yAxisIndex = 0,
  dashed = false,
): any[] {
  return [
    // P10 base (invisible, used for stack offset)
    {
      type: "line",
      name: "P10",
      data: percs.p10,
      yAxisIndex,
      lineStyle: { opacity: 0 },
      itemStyle: { color: baseColor },
      symbol: "none",
      stack: `band-outer-${yAxisIndex}`,
      silent: true,
    },
    // P90 - P10 band (visible)
    {
      type: "line",
      name: "P10–P90",
      data: percs.p90.map((v, i) => v - percs.p10[i]),
      yAxisIndex,
      lineStyle: { opacity: 0 },
      itemStyle: { color: baseColor },
      areaStyle: { color: baseColor, opacity: 0.12 },
      symbol: "none",
      stack: `band-outer-${yAxisIndex}`,
      silent: true,
    },
    // P25 base (invisible)
    {
      type: "line",
      name: "P25",
      data: percs.p25,
      yAxisIndex,
      lineStyle: { opacity: 0 },
      itemStyle: { color: baseColor },
      symbol: "none",
      stack: `band-inner-${yAxisIndex}`,
      silent: true,
    },
    // P75 - P25 band
    {
      type: "line",
      name: "P25–P75",
      data: percs.p75.map((v, i) => v - percs.p25[i]),
      yAxisIndex,
      lineStyle: { opacity: 0 },
      itemStyle: { color: baseColor },
      areaStyle: { color: baseColor, opacity: 0.28 },
      symbol: "none",
      stack: `band-inner-${yAxisIndex}`,
      silent: true,
    },
    // P50 median line
    {
      type: "line",
      name: "Median (P50)",
      data: percs.p50,
      yAxisIndex,
      lineStyle: {
        color: baseColor,
        width: 2,
        ...(dashed ? { type: "dashed" as const } : {}),
      },
      itemStyle: { color: baseColor },
      symbol: "none",
      smooth: false,
    },
  ];
}

interface AssetSeries {
  assetId: number;
  label: string;
  type: AssetType;
  timeSeries: TimeSeries | null;
}

interface ChartStepProps {
  selectedAssetIds: number[];
  nodeProperty: string | null;
  linkProperty: string | null;
}

export function ChartStep({
  selectedAssetIds,
  nodeProperty,
  linkProperty,
}: ChartStepProps) {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const simulation = useAtomValue(simulationDerivedAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { units, formatting } = useAtomValue(projectSettingsAtom);

  const [assetSeries, setAssetSeries] = useState<AssetSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const epsResultsReader = useMemo(() => {
    if ("epsResultsReader" in simulation) return simulation.epsResultsReader;
    return null;
  }, [simulation]);

  const qualityType = epsResultsReader?.qualityType ?? null;

  const assetTypes = useMemo(
    () =>
      selectedAssetIds.flatMap((id) => {
        const asset = hydraulicModel.assets.get(id);
        return asset ? [asset.type as AssetType] : [];
      }),
    [selectedAssetIds, hydraulicModel.assets],
  );

  const classification = useMemo(
    () => classifyAssetTypes(assetTypes),
    [assetTypes],
  );

  // Resolve the effective property for each asset
  const effectiveNodeProp = useMemo(() => {
    if (!classification.hasNodes) return null;
    const opts = getAvailableProperties(
      classification.nodeTypes as QuickGraphAssetType[],
      qualityType,
    );
    return nodeProperty ?? opts[0]?.value ?? null;
  }, [classification, nodeProperty, qualityType]);

  const effectiveLinkProp = useMemo(() => {
    if (!classification.hasLinks) return null;
    const opts = getAvailableProperties(
      classification.linkTypes as QuickGraphAssetType[],
      qualityType,
    );
    return linkProperty ?? opts[0]?.value ?? null;
  }, [classification, linkProperty, qualityType]);

  useEffect(() => {
    if (!epsResultsReader) return;

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const fetch = async () => {
      setIsLoading(true);
      try {
        const results = await Promise.all(
          selectedAssetIds.map(async (id) => {
            const asset = hydraulicModel.assets.get(id);
            if (!asset) return null;
            const prop = isNodeType(asset.type)
              ? effectiveNodeProp
              : effectiveLinkProp;
            if (!prop) return null;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            const ts = (await (epsResultsReader as any).getTimeSeries(
              id,
              asset.type,
              prop,
            )) as Awaited<
              ReturnType<typeof epsResultsReader.getTimeSeries>
            > | null;
            return {
              assetId: id,
              label: asset.label,
              type: asset.type,
              timeSeries: ts,
            };
          }),
        );
        if (signal.aborted) return;
        setAssetSeries(results.filter(Boolean) as AssetSeries[]);
      } catch (err) {
        if (signal.aborted) return;
        captureError(err as Error);
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    };

    void fetch();
    return () => abortRef.current?.abort();
  }, [
    selectedAssetIds,
    effectiveNodeProp,
    effectiveLinkProp,
    epsResultsReader,
    hydraulicModel.assets,
  ]);

  // Compute decimals for each axis
  const nodeDecimals = useMemo(() => {
    const opts = getAvailableProperties(
      classification.nodeTypes as QuickGraphAssetType[],
      qualityType,
    );
    const prop = opts.find((o) => o.value === effectiveNodeProp);
    return getDecimals(formatting, prop?.quantityKey as any) ?? 2;
  }, [classification.nodeTypes, effectiveNodeProp, qualityType, formatting]);

  const linkDecimals = useMemo(() => {
    const opts = getAvailableProperties(
      classification.linkTypes as QuickGraphAssetType[],
      qualityType,
    );
    const prop = opts.find((o) => o.value === effectiveLinkProp);
    return getDecimals(formatting, prop?.quantityKey as any) ?? 2;
  }, [classification.linkTypes, effectiveLinkProp, qualityType, formatting]);

  const nodeAxisLabel = useMemo(() => {
    const opts = getAvailableProperties(
      classification.nodeTypes as QuickGraphAssetType[],
      qualityType,
    );
    const prop = opts.find((o) => o.value === effectiveNodeProp);
    if (!prop) return "";
    const unit = units[prop.quantityKey as keyof typeof units];
    const label = translate(prop.labelKey);
    return unit ? `${label} (${translateUnit(unit)})` : label;
  }, [
    classification.nodeTypes,
    effectiveNodeProp,
    qualityType,
    units,
    translate,
    translateUnit,
  ]);

  const linkAxisLabel = useMemo(() => {
    const opts = getAvailableProperties(
      classification.linkTypes as QuickGraphAssetType[],
      qualityType,
    );
    const prop = opts.find((o) => o.value === effectiveLinkProp);
    if (!prop) return "";
    const unit = units[prop.quantityKey as keyof typeof units];
    const label = translate(prop.labelKey);
    return unit ? `${label} (${translateUnit(unit)})` : label;
  }, [
    classification.linkTypes,
    effectiveLinkProp,
    qualityType,
    units,
    translate,
    translateUnit,
  ]);

  const isMixed = classification.hasNodes && classification.hasLinks;

  const nodeSeries = assetSeries.filter((s) => isNodeType(s.type));
  const linkSeriesData = assetSeries.filter((s) => !isNodeType(s.type));

  const allNodeValues = nodeSeries.flatMap((s) =>
    s.timeSeries ? Array.from(s.timeSeries.values) : [],
  );
  const allLinkValues = linkSeriesData.flatMap((s) =>
    s.timeSeries ? Array.from(s.timeSeries.values) : [],
  );

  const timestepCount = assetSeries[0]?.timeSeries?.intervalsCount ?? 0;
  const intervalSeconds = assetSeries[0]?.timeSeries?.intervalSeconds ?? 3600;

  const option: EChartsOption = useMemo(() => {
    if (timestepCount === 0) return {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series: any[] = [];

    const buildGroup = (
      group: AssetSeries[],
      allValues: number[],
      decimals: number,
      yAxisIndex: number,
      colorScale: string[],
      dashed = false,
    ) => {
      if (group.length === 0) return;
      const valid = group.filter((s) => s.timeSeries);
      if (valid.length === 0) return;

      if (valid.length <= MAX_LINES) {
        valid.forEach((s, i) => {
          series.push(
            buildLineSeries(
              s.label,
              Array.from(s.timeSeries!.values),
              colorScale[i % colorScale.length] ?? colorScale[0],
              yAxisIndex,
              dashed,
            ),
          );
        });
      } else {
        const percs = computePercentileSeries(
          valid.map((s) => s.timeSeries!.values),
          timestepCount,
        );
        series.push(
          ...buildPercentileSeries(percs, colorScale[0], yAxisIndex, dashed),
        );
      }
    };

    buildGroup(
      nodeSeries,
      allNodeValues,
      nodeDecimals,
      0,
      isMixed ? EMERALD_SCALE : CHART_COLORS,
    );
    buildGroup(
      linkSeriesData,
      allLinkValues,
      linkDecimals,
      isMixed ? 1 : 0,
      isMixed ? ORANGE_SCALE : CHART_COLORS,
      isMixed,
    );

    const yAxisLeft = buildYAxisConfig(
      isMixed ? allNodeValues : [...allNodeValues, ...allLinkValues],
      isMixed
        ? nodeDecimals
        : nodeSeries.length > 0
          ? nodeDecimals
          : linkDecimals,
      isMixed
        ? nodeAxisLabel
        : nodeSeries.length > 0
          ? nodeAxisLabel
          : linkAxisLabel,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yAxis: any = isMixed
      ? [
          { ...yAxisLeft, position: "left" },
          {
            ...buildYAxisConfig(allLinkValues, linkDecimals, linkAxisLabel),
            position: "right",
            alignTicks: true,
            splitLine: { show: false },
          },
        ]
      : { ...yAxisLeft };

    return {
      animation: false,
      grid: { top: 28, right: 16, bottom: 36, left: 16, containLabel: true },
      legend: {
        show: true,
        bottom: 0,
        left: "center",
        itemWidth: 16,
        itemHeight: 8,
        textStyle: { fontSize: 11, color: colors.gray600 },
      },
      xAxis: buildXAxis(timestepCount, intervalSeconds),
      yAxis,
      series,
      tooltip: {
        trigger: "axis",
        appendToBody: true,
        backgroundColor: "white",
        borderColor: colors.gray300,
        textStyle: { color: colors.gray700, fontSize: 13 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const timeLabel = params[0]?.name ?? "";
          const lines = params
            .filter(
              (p: any) =>
                !["P10", "P25", "P10–P90", "P25–P75"].includes(p.seriesName),
            )
            .map((p: any) => {
              const dec =
                p.seriesIndex < nodeSeries.length ? nodeDecimals : linkDecimals;
              const dot = `<span style="display:inline-block;width:8px;height:8px;background:${p.color};margin-right:4px;border-radius:50%;"></span>`;
              return `${dot}${p.seriesName}: ${localizeDecimal(p.value, { decimals: dec })}`;
            });
          return `${timeLabel}<br/>${lines.join("<br/>")}`;
        },
      },
    };
  }, [
    timestepCount,
    intervalSeconds,
    nodeSeries,
    linkSeriesData,
    allNodeValues,
    allLinkValues,
    nodeDecimals,
    linkDecimals,
    nodeAxisLabel,
    linkAxisLabel,
    isMixed,
  ]);

  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance()?.resize();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  if (!epsResultsReader) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        {translate("chartBuilder.label")}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!isLoading && timestepCount === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          No data available
        </div>
      ) : (
        <div className="absolute inset-0">
          <ReactECharts
            ref={chartRef}
            option={option}
            style={{ height: "100%", width: "100%" }}
            opts={{ renderer: "svg" }}
          />
        </div>
      )}
    </div>
  );
}
