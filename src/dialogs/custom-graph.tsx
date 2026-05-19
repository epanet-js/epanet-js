"use client";
import { useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useAtomValue } from "jotai";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import * as DD from "@radix-ui/react-dropdown-menu";
import { BaseDialog } from "src/components/dialog";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { Selector } from "src/components/form/selector";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { colors } from "src/lib/constants";
import { getDecimals } from "src/lib/project-settings";
import { projectSettingsAtom } from "src/state/project-settings";
import type { QuantityProperty } from "src/lib/project-settings/quantities-spec";
import { ChevronDownIcon } from "src/icons";
import {
  useCustomGraphData,
  type AssetTimeSeries,
} from "./custom-graph/use-custom-graph-data";

type NodeProperty = "pressure" | "head";
type LinkProperty = "flow" | "velocity" | "headloss";
type QualityProperty = "waterAge" | "waterTrace" | "chemicalConcentration";

interface PropertyOption<T extends string> {
  value: T;
  labelKey: string;
  quantityKey: QuantityProperty;
}

interface CustomGraphChartProps {
  seriesData: AssetTimeSeries[];
  nodeCount: number;
  nodeYAxisLabel: string;
  linkYAxisLabel: string;
  nodeDecimals: number;
  linkDecimals: number;
  unitLabels: string[];
}

export const CustomGraphDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const { units, formatting } = useAtomValue(projectSettingsAtom);

  const {
    hasNodes,
    hasLinks,
    nodeSeriesData,
    linkSeriesData,
    isLoading,
    qualityType,
    nodeProperty,
    linkProperty,
    setNodeProperty,
    setLinkProperty,
  } = useCustomGraphData();

  const nodePropertyOptions = useMemo(() => {
    const opts: PropertyOption<NodeProperty | QualityProperty>[] = [
      ...NODE_PROPERTIES,
    ];
    if (qualityType && qualityType !== "none" && QUALITY_OPTIONS[qualityType]) {
      opts.push(QUALITY_OPTIONS[qualityType]);
    }
    return opts.map((opt) => {
      const label = translate(opt.labelKey);
      const unit = units[opt.quantityKey];
      return {
        value: opt.value,
        label: unit ? `${label} (${translateUnit(unit)})` : label,
      };
    });
  }, [translate, translateUnit, units, qualityType]);

  const linkPropertyOptions = useMemo(() => {
    const opts: PropertyOption<LinkProperty | QualityProperty>[] = [
      ...LINK_PROPERTIES,
    ];
    if (qualityType && qualityType !== "none" && QUALITY_OPTIONS[qualityType]) {
      opts.push(QUALITY_OPTIONS[qualityType]);
    }
    return opts.map((opt) => {
      const label = translate(opt.labelKey);
      const unit = units[opt.quantityKey];
      return {
        value: opt.value,
        label: unit ? `${label} (${translateUnit(unit)})` : label,
      };
    });
  }, [translate, translateUnit, units, qualityType]);

  const nodeQuantityKey = useMemo(() => {
    const allOpts = [...NODE_PROPERTIES, ...Object.values(QUALITY_OPTIONS)];
    return (
      allOpts.find((o) => o.value === nodeProperty)?.quantityKey ?? "pressure"
    );
  }, [nodeProperty]);

  const linkQuantityKey = useMemo(() => {
    const allOpts = [...LINK_PROPERTIES, ...Object.values(QUALITY_OPTIONS)];
    return allOpts.find((o) => o.value === linkProperty)?.quantityKey ?? "flow";
  }, [linkProperty]);

  const nodeDecimals = getDecimals(formatting, nodeQuantityKey) ?? 0;
  const linkDecimals = getDecimals(formatting, linkQuantityKey) ?? 0;

  const nodeUnitLabel = useMemo(() => {
    const unit = units[nodeQuantityKey];
    return unit ? translateUnit(unit) : "";
  }, [translateUnit, units, nodeQuantityKey]);

  const linkUnitLabel = useMemo(() => {
    const unit = units[linkQuantityKey];
    return unit ? translateUnit(unit) : "";
  }, [translateUnit, units, linkQuantityKey]);

  const nodeYAxisLabel = useMemo(() => {
    const label = translate(
      NODE_PROPERTIES.find((p) => p.value === nodeProperty)?.labelKey ??
        Object.values(QUALITY_OPTIONS).find((p) => p.value === nodeProperty)
          ?.labelKey ??
        nodeProperty,
    );
    return nodeUnitLabel ? `${label} (${nodeUnitLabel})` : label;
  }, [translate, nodeUnitLabel, nodeProperty]);

  const linkYAxisLabel = useMemo(() => {
    const label = translate(
      LINK_PROPERTIES.find((p) => p.value === linkProperty)?.labelKey ??
        Object.values(QUALITY_OPTIONS).find((p) => p.value === linkProperty)
          ?.labelKey ??
        linkProperty,
    );
    return linkUnitLabel ? `${label} (${linkUnitLabel})` : label;
  }, [translate, linkUnitLabel, linkProperty]);

  const combinedSeriesData = useMemo(
    () => [...nodeSeriesData, ...linkSeriesData],
    [nodeSeriesData, linkSeriesData],
  );

  const unitLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < nodeSeriesData.length; i++) labels.push(nodeUnitLabel);
    for (let i = 0; i < linkSeriesData.length; i++) labels.push(linkUnitLabel);
    return labels;
  }, [
    nodeSeriesData.length,
    linkSeriesData.length,
    nodeUnitLabel,
    linkUnitLabel,
  ]);

  const handleNodePropertyChange = useCallback(
    (value: string) => setNodeProperty(value),
    [setNodeProperty],
  );
  const handleLinkPropertyChange = useCallback(
    (value: string) => setLinkProperty(value),
    [setLinkProperty],
  );

  return (
    <BaseDialog
      title={translate("customGraph.title")}
      size="xxl"
      height="xxl"
      isOpen={true}
      onClose={onClose}
      footer={
        <footer className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-200">
          <DD.Root>
            <DD.Trigger asChild>
              <Button variant="default" type="button">
                {translate("customGraph.exportAs")}
                <ChevronDownIcon />
              </Button>
            </DD.Trigger>
            <DDContent align="start" side="top">
              <StyledItem onSelect={() => {}}>
                {translate("customGraph.imagePng")}
              </StyledItem>
              <StyledItem onSelect={() => {}}>
                {translate("customGraph.tabularCsv")}
              </StyledItem>
              <StyledItem onSelect={() => {}}>
                {translate("customGraph.tabularXlsx")}
              </StyledItem>
            </DDContent>
          </DD.Root>
          <Button variant="default" type="button" onClick={onClose}>
            {translate("dialog.close")}
          </Button>
        </footer>
      }
    >
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex items-center gap-4 px-4 pt-3 pb-2 shrink-0 flex-wrap">
          {hasNodes && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">
                {translate("customGraph.nodeProperty")}
              </span>
              <Selector
                options={nodePropertyOptions}
                selected={nodeProperty}
                onChange={handleNodePropertyChange}
                styleOptions={{
                  border: true,
                  textSize: "text-sm",
                  paddingY: 1,
                }}
              />
            </div>
          )}
          {hasLinks && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">
                {translate("customGraph.linkProperty")}
              </span>
              <Selector
                options={linkPropertyOptions}
                selected={linkProperty}
                onChange={handleLinkPropertyChange}
                styleOptions={{
                  border: true,
                  textSize: "text-sm",
                  paddingY: 1,
                }}
              />
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && combinedSeriesData.length > 0 && (
          <div className="flex-1 min-h-0 px-4 pb-2">
            <CustomGraphChart
              seriesData={combinedSeriesData}
              nodeCount={nodeSeriesData.length}
              nodeYAxisLabel={nodeYAxisLabel}
              linkYAxisLabel={linkYAxisLabel}
              nodeDecimals={nodeDecimals}
              linkDecimals={linkDecimals}
              unitLabels={unitLabels}
            />
          </div>
        )}
        {!isLoading && combinedSeriesData.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            {translate("noDataAvailable")}
          </div>
        )}
      </div>
    </BaseDialog>
  );
};

const CustomGraphChart = memo(function CustomGraphChart({
  seriesData,
  nodeCount,
  nodeYAxisLabel,
  linkYAxisLabel,
  nodeDecimals,
  linkDecimals,
  unitLabels,
}: CustomGraphChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasBothAxes = nodeCount > 0 && nodeCount < seriesData.length;

  const firstSeries = seriesData[0]?.timeSeries;
  const intervalsCount = firstSeries?.intervalsCount ?? 0;
  const intervalSeconds = firstSeries?.intervalSeconds ?? 0;

  const nodeValues = useMemo(
    () =>
      seriesData
        .slice(0, nodeCount)
        .flatMap((s) => Array.from(s.timeSeries.values)),
    [seriesData, nodeCount],
  );
  const linkValues = useMemo(
    () =>
      seriesData
        .slice(nodeCount)
        .flatMap((s) => Array.from(s.timeSeries.values)),
    [seriesData, nodeCount],
  );

  const xAxisInterval = useMemo(
    () => calculateXAxisInterval(intervalsCount, intervalSeconds),
    [intervalsCount, intervalSeconds],
  );
  const xAxisStep = useMemo(
    () => calculateXAxisStep(intervalsCount, intervalSeconds),
    [intervalsCount, intervalSeconds],
  );

  const xAxis: EChartsOption["xAxis"] = useMemo(
    () => ({
      type: "category",
      data: buildTimeLabels(intervalsCount, intervalSeconds),
      show: true,
      boundaryGap: false,
      splitLine: {
        show: true,
        lineStyle: { color: colors.gray300, type: "dashed" },
        interval: (index: number) => {
          if (index === intervalsCount - 1) return false;
          return index % xAxisStep === 0;
        },
      },
      axisTick: {
        show: true,
        alignWithLabel: true,
        lineStyle: { color: colors.gray300 },
        interval: (index: number) => index % xAxisStep === 0,
      },
      axisLabel: {
        show: true,
        interval: xAxisInterval,
        color: colors.gray500,
        fontSize: 12,
        hideOverlap: true,
      },
      axisLine: { show: true, lineStyle: { color: colors.gray300 } },
    }),
    [intervalsCount, intervalSeconds, xAxisStep, xAxisInterval],
  );

  const yAxis: EChartsOption["yAxis"] = useMemo(() => {
    const buildYAxis = (
      label: string,
      decimals: number,
      values: number[],
      position: "left" | "right",
      showSplitLine: boolean,
    ) => {
      const { min, max, interval } = calculateInterval(decimals, values, 5);
      return {
        type: "value" as const,
        scale: true,
        position,
        name: label,
        nameLocation: "middle" as const,
        nameGap: 50,
        nameTextStyle: { color: colors.gray500, fontSize: 13 },
        min,
        max,
        interval,
        splitLine: {
          show: showSplitLine,
          lineStyle: { color: colors.gray300, type: "dashed" as const },
        },
        axisLine: { show: true, lineStyle: { color: colors.gray300 } },
        axisTick: { show: true, lineStyle: { color: colors.gray300 } },
        axisLabel: {
          color: colors.gray500,
          fontSize: 12,
          formatter: (value: number) => localizeDecimal(value),
        },
      };
    };

    if (hasBothAxes) {
      return [
        buildYAxis(linkYAxisLabel, linkDecimals, linkValues, "left", true),
        buildYAxis(nodeYAxisLabel, nodeDecimals, nodeValues, "right", false),
      ];
    }

    const isNodeOnly = nodeCount > 0;
    return buildYAxis(
      isNodeOnly ? nodeYAxisLabel : linkYAxisLabel,
      isNodeOnly ? nodeDecimals : linkDecimals,
      isNodeOnly ? nodeValues : linkValues,
      "left",
      true,
    );
  }, [
    hasBothAxes,
    nodeCount,
    nodeValues,
    linkValues,
    nodeDecimals,
    linkDecimals,
    nodeYAxisLabel,
    linkYAxisLabel,
  ]);

  const series: EChartsOption["series"] = useMemo(
    () =>
      seriesData.map((s, i) => {
        const color = SERIES_COLORS[i % SERIES_COLORS.length];
        const isNode = i < nodeCount;
        return {
          type: "line" as const,
          name: s.label,
          data: Array.from(s.timeSeries.values),
          lineStyle: { color, width: 2 },
          itemStyle: { color },
          symbol: "none",
          smooth: false,
          ...(hasBothAxes ? { yAxisIndex: isNode ? 1 : 0 } : {}),
        };
      }),
    [seriesData, nodeCount, hasBothAxes],
  );

  const option: EChartsOption = useMemo(
    () => ({
      animation: false,
      grid: {
        top: 8,
        right: 40,
        bottom: 32,
        left: 40,
        containLabel: true,
      },
      legend: {
        show: true,
        bottom: 0,
        left: "center",
        itemWidth: 16,
        itemHeight: 8,
        textStyle: { fontSize: 12, color: colors.gray600 },
        data:
          seriesData.length > MAX_VISIBLE_SERIES
            ? [
                ...seriesData.slice(0, MAX_VISIBLE_SERIES).map((s) => s.label),
                `...other ${seriesData.length - MAX_VISIBLE_SERIES} assets`,
              ]
            : undefined,
        formatter: (name: string) => name,
      },
      xAxis,
      yAxis,
      series,
      tooltip: {
        trigger: "axis",
        appendToBody: true,
        backgroundColor: "white",
        borderColor: colors.gray300,
        textStyle: { color: colors.gray700, fontSize: 14 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const timeLabel = params[0]?.name ?? "";
          const visible = params.slice(0, MAX_VISIBLE_SERIES);
          const remaining = params.length - MAX_VISIBLE_SERIES;
          const rows = visible.map(
            (
              p: {
                color: string;
                seriesName?: string;
                seriesIndex?: number;
                value: number;
              },
              i: number,
            ) => {
              const value = p.value.toFixed(TOOLTIP_DECIMALS);
              const unit = unitLabels[p.seriesIndex ?? i] ?? "";
              const idx = p.seriesIndex ?? i;
              const assetType = idx < nodeCount ? "node" : "link";
              const colorDot = `<span style="display:inline-block;width:8px;height:8px;background:${p.color};margin-right:4px;border-radius:50%;vertical-align:middle;"></span>`;
              return (
                `<tr>` +
                `<td>${colorDot}${p.seriesName ?? ""} <span style="color:${colors.gray400}">(${assetType})</span></td>` +
                `<td style="font-variant-numeric:tabular-nums;text-align:right;padding-left:16px;">${value}</td>` +
                `<td style="padding-left:4px;">${unit}</td>` +
                `</tr>`
              );
            },
          );
          let footer = "";
          if (remaining > 0) {
            footer = `<tr><td colspan="3" style="color:${colors.gray500};font-size:12px;">...other ${remaining} assets</td></tr>`;
          }
          return `${timeLabel}<table style="border-spacing:0;">${rows.join("")}${footer}</table>`;
        },
      },
    }),
    [seriesData, xAxis, yAxis, series, unitLabels, nodeCount],
  );

  useEffect(function resizeChart() {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance()?.resize();
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  if (intervalsCount === 0 || seriesData.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <ReactECharts
        ref={chartRef}
        key={`${intervalSeconds}-${intervalsCount}`}
        option={option}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
});

const NODE_PROPERTIES: PropertyOption<NodeProperty>[] = [
  { value: "pressure", labelKey: "pressure", quantityKey: "pressure" },
  { value: "head", labelKey: "head", quantityKey: "head" },
];

const LINK_PROPERTIES: PropertyOption<LinkProperty>[] = [
  { value: "flow", labelKey: "flow", quantityKey: "flow" },
  { value: "velocity", labelKey: "velocity", quantityKey: "velocity" },
  {
    value: "headloss",
    labelKey: "unitHeadloss",
    quantityKey: "unitHeadloss",
  },
];

const QUALITY_OPTIONS: Record<string, PropertyOption<QualityProperty>> = {
  age: {
    value: "waterAge",
    labelKey: "waterAge",
    quantityKey: "waterAge",
  },
  trace: {
    value: "waterTrace",
    labelKey: "waterTrace",
    quantityKey: "waterTrace",
  },
  chemical: {
    value: "chemicalConcentration",
    labelKey: "chemicalConcentration",
    quantityKey: "chemicalConcentration",
  },
};

const MAX_VISIBLE_SERIES = 6;
const TOOLTIP_DECIMALS = 3;

const SERIES_COLORS = [
  colors.purple500,
  colors.blue500,
  colors.orange500,
  colors.cyan700,
  colors.fuchsia500,
  colors.green800,
  colors.red600,
  colors.indigo500,
  colors.amber500,
  colors.cyan900,
];

const buildTimeLabels = (
  intervalsCount: number,
  intervalSeconds: number,
): string[] => {
  const labels: string[] = [];
  for (let i = 0; i < intervalsCount; i++) {
    const totalSeconds = i * intervalSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    labels.push(
      `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
    );
  }
  return labels;
};

const calculateXAxisInterval = (
  intervalCount: number,
  intervalSeconds: number,
  targetTickCount = 8,
) => {
  const totalSeconds = intervalCount * intervalSeconds;
  const idealStep = totalSeconds / (targetTickCount - 1 || 1);
  const logicalSteps = [3600, 7200, 10800, 14400, 21600, 28800, 43200, 86400];
  const bestStepSeconds = logicalSteps.reduce((prev, curr) =>
    Math.abs(curr - idealStep) < Math.abs(prev - idealStep) ? curr : prev,
  );
  const indexInterval = Math.max(
    1,
    Math.round(bestStepSeconds / intervalSeconds),
  );
  return (index: number) => index % indexInterval === 0;
};

const calculateXAxisStep = (
  intervalCount: number,
  intervalSeconds: number,
  targetTickCount = 8,
): number => {
  const totalSeconds = intervalCount * intervalSeconds;
  const rawStep = totalSeconds / Math.max(targetTickCount - 1, 1);
  const step = [3600, 7200, 10800, 14400, 21600, 28800, 43200, 86400].reduce(
    (prev, curr) =>
      Math.abs(curr - rawStep) < Math.abs(prev - rawStep) ? curr : prev,
  );
  return Math.max(1, Math.round(step / intervalSeconds));
};

const calculateInterval = (
  decimals: number,
  values: number[],
  targetIntervalsCount = 5,
): { min: number; max: number; interval: number } => {
  if (values.length === 0) return { min: 0, max: 0, interval: 0 };

  const factor = Math.pow(10, decimals);
  const minVal = Math.floor(Math.min(...values) * factor) / factor;
  const maxVal = Math.ceil(Math.max(...values) * factor) / factor;
  const range = maxVal - minVal;

  const minPrecision = Math.pow(10, -decimals + 1);
  let niceInterval = minPrecision;
  if (range > 0) {
    const roughInterval = range / (targetIntervalsCount - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));
    const normalizedInterval = roughInterval / magnitude;
    const niceFactor = [1, 2, 2.5, 5, 10].reduce((prev, curr) =>
      Math.abs(curr - normalizedInterval) < Math.abs(prev - normalizedInterval)
        ? curr
        : prev,
    );
    niceInterval = Math.max(
      Math.round(niceFactor * magnitude * factor) / factor,
      minPrecision,
    );
  }
  if (niceInterval > minPrecision) {
    const min = Math.floor(minVal / niceInterval) * niceInterval;
    const max = Math.ceil(maxVal / niceInterval) * niceInterval;
    return { min, max, interval: niceInterval };
  }

  const offset =
    (targetIntervalsCount - 1) * minPrecision - Math.abs(maxVal - minVal);
  const halfOffset = offset / 2;

  let min: number;
  let max: number;
  if (minVal >= 0 && minVal < halfOffset) {
    const maxOffset = offset - minVal;
    min = 0;
    max = Math.floor((maxVal + maxOffset) / minPrecision) * minPrecision;
  } else {
    min = Math.ceil((minVal - halfOffset) / minPrecision) * minPrecision;
    max = Math.floor((maxVal + halfOffset) / minPrecision) * minPrecision;
  }

  while (min > minVal) min -= minPrecision;
  while (max < maxVal) max += minPrecision;

  return { min, max, interval: minPrecision };
};
