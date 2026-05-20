"use client";
import { useRef, useMemo, useCallback, useState } from "react";
import { useAtomValue } from "jotai";
import ReactECharts from "echarts-for-react";
import * as DD from "@radix-ui/react-dropdown-menu";
import { BaseDialog } from "src/components/dialog";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { Selector } from "src/components/form/selector";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { getDecimals } from "src/lib/project-settings";
import { projectSettingsAtom } from "src/state/project-settings";
import { ChevronDownIcon } from "src/icons";
import {
  CustomGraphChart,
  GraphDefaultOptions,
  LinkProperty,
  NodeProperty,
  PropertyOption,
  QualityProperty,
  useCustomGraphData,
} from "./custom-graph";
import { currentFileNameAtom } from "src/state";
import { useExportSimulationResults } from "src/commands/export-simulation-results";
import { ExportSimulationResultsProperties } from "src/lib/export/types";
import { useUserTracking } from "src/infra/user-tracking";

export const CustomGraphDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const exportSimulationResults = useExportSimulationResults();
  const { capture } = useUserTracking();
  const fullNetworkName = useAtomValue(currentFileNameAtom) ?? "";
  const networkNameDot = fullNetworkName.lastIndexOf(".");
  const networkName = fullNetworkName.substring(
    0,
    networkNameDot < 0 ? fullNetworkName.length - 1 : networkNameDot,
  );

  const chartRef = useRef<ReactECharts>(null);
  const { units, formatting } = useAtomValue(projectSettingsAtom);
  const [progress, setProgress] = useState(0);

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
  } = useCustomGraphData(setProgress);

  const nodePropertyOptions = useMemo(() => {
    const opts: PropertyOption<NodeProperty | QualityProperty>[] = [
      ...GraphDefaultOptions.NODE_PROPERTIES,
    ];
    if (
      qualityType &&
      qualityType !== "none" &&
      GraphDefaultOptions.QUALITY_OPTIONS[qualityType]
    ) {
      opts.push(GraphDefaultOptions.QUALITY_OPTIONS[qualityType]);
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
      ...GraphDefaultOptions.LINK_PROPERTIES,
    ];
    if (
      qualityType &&
      qualityType !== "none" &&
      GraphDefaultOptions.QUALITY_OPTIONS[qualityType]
    ) {
      opts.push(GraphDefaultOptions.QUALITY_OPTIONS[qualityType]);
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
    const allOpts = [
      ...GraphDefaultOptions.NODE_PROPERTIES,
      ...Object.values(GraphDefaultOptions.QUALITY_OPTIONS),
    ];
    return (
      allOpts.find((o) => o.value === nodeProperty)?.quantityKey ?? "pressure"
    );
  }, [nodeProperty]);

  const linkQuantityKey = useMemo(() => {
    const allOpts = [
      ...GraphDefaultOptions.LINK_PROPERTIES,
      ...Object.values(GraphDefaultOptions.QUALITY_OPTIONS),
    ];
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
      GraphDefaultOptions.NODE_PROPERTIES.find((p) => p.value === nodeProperty)
        ?.labelKey ??
        Object.values(GraphDefaultOptions.QUALITY_OPTIONS).find(
          (p) => p.value === nodeProperty,
        )?.labelKey ??
        nodeProperty,
    );
    return nodeUnitLabel ? `${label} (${nodeUnitLabel})` : label;
  }, [translate, nodeUnitLabel, nodeProperty]);

  const linkYAxisLabel = useMemo(() => {
    const label = translate(
      GraphDefaultOptions.LINK_PROPERTIES.find((p) => p.value === linkProperty)
        ?.labelKey ??
        Object.values(GraphDefaultOptions.QUALITY_OPTIONS).find(
          (p) => p.value === linkProperty,
        )?.labelKey ??
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

  const trackExport = (format: "png" | "csv" | "xlsx") =>
    capture({
      name: "customGraph.exported",
      format,
      numAssets: nodeSeriesData.length + linkSeriesData.length,
    });

  const exportAsPng = () => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;

    const svgUrl = instance.getDataURL({ type: "svg" });
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ratio = 2;
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(ratio, ratio);
      ctx.drawImage(img, 0, 0);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${networkName}-graph.png`;
      a.click();

      trackExport("png");
    };

    img.src = svgUrl;
  };

  const exportTabular = async (format: "csv" | "xlsx") => {
    const nodeIds = nodeSeriesData.map((n) => n.assetId);
    const linkIds = linkSeriesData.map((n) => n.assetId);
    const selectedAssets = new Set<number>([...nodeIds, ...linkIds]);
    const mappedLinkProperty =
      linkIds.length > 0
        ? [linkProperty === "headloss" ? "unitHeadloss" : linkProperty]
        : [];
    const mappedNodeProperty =
      nodeIds.length > 0
        ? [
            GraphDefaultOptions.WATER_QUALITY_PROPERTIES.includes(nodeProperty)
              ? "waterQuality"
              : nodeProperty,
          ]
        : [];

    const properties = [
      ...mappedNodeProperty,
      ...mappedLinkProperty,
    ] as ExportSimulationResultsProperties[];

    await exportSimulationResults({
      format,
      onProgress: async () => Promise.resolve(),
      properties,
      selectedAssets,
    });

    trackExport(format);
  };

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
              <Button variant="default" type="button" disabled={isLoading}>
                {translate("customGraph.exportAs")}
                <ChevronDownIcon />
              </Button>
            </DD.Trigger>
            <DDContent align="start" side="top">
              <StyledItem onSelect={exportAsPng}>
                {translate("customGraph.imagePng")}
              </StyledItem>
              <StyledItem onSelect={() => exportTabular("csv")}>
                {translate("customGraph.tabularCsv")}
              </StyledItem>
              <StyledItem onSelect={() => exportTabular("xlsx")}>
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
                disabled={isLoading}
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
                disabled={isLoading}
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
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
            <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">
              {translate("customGraph.loading", progress.toFixed(0))}
            </span>
          </div>
        )}

        {!isLoading && combinedSeriesData.length > 0 && (
          <div className="flex-1 min-h-0 px-4 pb-2">
            <CustomGraphChart
              ref={chartRef}
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
