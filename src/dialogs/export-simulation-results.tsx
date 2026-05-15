import { useState, useRef, useEffect, useCallback } from "react";
import { useAtomValue } from "jotai";
import { useExportSimulationResults } from "src/commands/export-simulation-results";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { ExportSimulationResultsProgressDialog } from "./export-simulation-results-progress";
import { useTranslate } from "src/hooks/use-translate";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { stagingModelAtom } from "src/state/hydraulic-model";
import {
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import { Export } from "src/lib/export";
import type { ExportSimulationResultsProperties } from "src/lib/export/types";

type SimulationExportFormat = "csv" | "xlsx";

const exportFormats: { value: SimulationExportFormat; labelKey: string }[] = [
  { value: "csv", labelKey: "exportCsv" },
  { value: "xlsx", labelKey: "exportXlsx" },
];

const SIZE_WARNING_LIMIT_GB = 1;

type NodeFields = {
  pressure: boolean;
  head: boolean;
  demand: boolean;
  waterQuality: boolean;
};

type LinkFields = {
  status: boolean;
  flow: boolean;
  velocity: boolean;
  unitHeadloss: boolean;
};

const IndeterminateCheckbox = ({
  checked,
  indeterminate,
  onChange,
  className,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={className}
    />
  );
};

export const ExportSimulationResultsDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const exportSimulationResults = useExportSimulationResults();

  const selection = useAtomValue(selectionAtom);
  const selectedIds = USelection.toIds(selection);
  const hasSelection = selectedIds.length > 0;

  const model = useAtomValue(stagingModelAtom);
  const simulation = useAtomValue(simulationDerivedAtom);
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const isWaterQualityEnabled =
    simulationSettings.qualitySimulationType !== "none";
  const epsResultsReader =
    "epsResultsReader" in simulation ? simulation.epsResultsReader : null;
  const timestepCount = epsResultsReader?.timestepCount ?? 0;

  const [format, setFormat] = useState<SimulationExportFormat>("csv");
  const [selectedAssetsOnly, setSelectedAssetsOnly] = useState(false);
  const [nodeFields, setNodeFields] = useState<NodeFields>({
    pressure: true,
    head: true,
    demand: true,
    waterQuality: isWaterQualityEnabled,
  });
  const [linkFields, setLinkFields] = useState<LinkFields>({
    status: true,
    flow: true,
    velocity: true,
    unitHeadloss: true,
  });

  const enabledNodeFields = Object.entries(nodeFields).filter(
    ([key]) => key !== "waterQuality" || isWaterQualityEnabled,
  );
  const nodeCheckedCount = enabledNodeFields.filter(([, v]) => v).length;
  const nodeTotal = enabledNodeFields.length;
  const nodeAllChecked = nodeCheckedCount === nodeTotal;
  const nodeIndeterminate = nodeCheckedCount > 0 && !nodeAllChecked;

  const linkCheckedCount = Object.values(linkFields).filter(Boolean).length;
  const linkTotal = Object.keys(linkFields).length;
  const linkAllChecked = linkCheckedCount === linkTotal;
  const linkIndeterminate = linkCheckedCount > 0 && !linkAllChecked;

  const toggleAllNodes = () => {
    const next = !nodeAllChecked;
    setNodeFields({
      pressure: next,
      head: next,
      demand: next,
      waterQuality: isWaterQualityEnabled && next,
    });
  };

  const toggleAllLinks = () => {
    const next = !linkAllChecked;
    setLinkFields({
      status: next,
      flow: next,
      velocity: next,
      unitHeadloss: next,
    });
  };

  const selectedNodeProperties = (
    Object.entries(nodeFields) as [keyof NodeFields, boolean][]
  )
    .filter(([, checked]) => checked)
    .map(([key]) => key as ExportSimulationResultsProperties);
  const selectedLinkProperties = (
    Object.entries(linkFields) as [keyof LinkFields, boolean][]
  )
    .filter(([, checked]) => checked)
    .map(([key]) => key as ExportSimulationResultsProperties);

  const assetCount = hasSelection ? selectedIds.length : model.assets.size;

  const estimatedBytes = Export.estimateSimulationResultsSize(
    format,
    [...selectedNodeProperties, ...selectedLinkProperties],
    assetCount,
    timestepCount,
  );
  const estimatedGB = estimatedBytes / 1024 ** 3;

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProperty, setCurrentProperty] =
    useState<ExportSimulationResultsProperties | null>(null);
  const progressCalls = useRef(0);
  const lastYield = useRef(0);

  const [isComplete, setIsComplete] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [sizeLimit, setSizeLimit] = useState(-1);
  useEffect(() => {
    void Export.fileSizeLimit().then(setSizeLimit);
  }, []);

  const onProgress = async (
    progress: number,
    property: ExportSimulationResultsProperties,
  ) => {
    if (++progressCalls.current >= 1000) {
      progressCalls.current = 0;
      if (performance.now() - lastYield.current >= 16) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        lastYield.current = performance.now();
      }
    }
    setProgress(progress);
    setCurrentProperty(property);
  };

  const exceedsLimit = sizeLimit > 0 && estimatedBytes > sizeLimit;
  const showSizeWarning = estimatedGB >= SIZE_WARNING_LIMIT_GB || exceedsLimit;
  const exportDisabled =
    isExporting || exceedsLimit || nodeCheckedCount + linkCheckedCount === 0;

  const handleExport = useCallback(async () => {
    const properties = [...selectedNodeProperties, ...selectedLinkProperties];
    const selectedAssets = selectedAssetsOnly
      ? new Set(selectedIds)
      : new Set<number>();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsExporting(true);
    setProgress(0);
    setIsComplete(false);
    try {
      await exportSimulationResults({
        format,
        properties,
        selectedAssets,
        onProgress,
        signal: controller.signal,
      });
      setIsComplete(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      throw err;
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  }, [
    format,
    selectedNodeProperties,
    selectedLinkProperties,
    selectedAssetsOnly,
    selectedIds,
    exportSimulationResults,
  ]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    onClose();
  }, [onClose]);

  if (isExporting || isComplete) {
    return (
      <ExportSimulationResultsProgressDialog
        progress={progress}
        currentProperty={currentProperty}
        isComplete={isComplete}
        onCancel={handleCancel}
        onClose={onClose}
      />
    );
  }

  if (model.assets.size === 0) {
    return (
      <BaseDialog
        title={translate("exportTimeSeries")}
        size="sm"
        isOpen={true}
        onClose={onClose}
        footer={
          <SimpleDialogActions
            action={translate("dialog.close")}
            onAction={onClose}
          />
        }
      >
        <div className="p-4">
          <p className="text-sm text-gray-700">
            {translate("exportAssetData.noAssets")}
          </p>
        </div>
      </BaseDialog>
    );
  }

  if (epsResultsReader === null) {
    return (
      <BaseDialog
        title={translate("exportTimeSeries")}
        size="sm"
        isOpen={true}
        onClose={onClose}
        footer={
          <SimpleDialogActions
            action={translate("dialog.close")}
            onAction={onClose}
          />
        }
      >
        <div className="p-4">
          <p className="text-sm text-gray-700">
            {translate("exportTimeSeries.noSimulation")}
          </p>
        </div>
      </BaseDialog>
    );
  }

  return (
    <BaseDialog
      title={translate("exportTimeSeries")}
      size="sm"
      isOpen={true}
      onClose={handleCancel}
      footer={
        <SimpleDialogActions
          action={translate("export")}
          onAction={handleExport}
          isDisabled={exportDisabled}
          secondary={{
            action: translate("dialog.cancel"),
            onClick: handleCancel,
          }}
        />
      }
    >
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {translate("exportFormat")}
          </label>
          <select
            value={format}
            onChange={(e) =>
              setFormat(e.target.value as SimulationExportFormat)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {exportFormats.map(({ value, labelKey }) => (
              <option key={value} value={value}>
                {translate(labelKey)}
              </option>
            ))}
          </select>
        </div>

        <label
          className={`flex items-center gap-x-2 ${hasSelection ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
        >
          <input
            type="checkbox"
            checked={selectedAssetsOnly}
            disabled={!hasSelection}
            onChange={(e) => setSelectedAssetsOnly(e.target.checked)}
            className="rounded text-purple-600 focus:ring-purple-500 disabled:opacity-50"
          />
          <span className="text-sm text-gray-700">
            {translate("exportSelectedAssetsOnly")}
          </span>
        </label>

        <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
          <div className="space-y-2">
            <label className="flex items-center gap-x-2 cursor-pointer">
              <IndeterminateCheckbox
                checked={nodeAllChecked}
                indeterminate={nodeIndeterminate}
                onChange={toggleAllNodes}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-900">
                {translate("nodes")}
              </span>
            </label>
            <div className="pl-5 space-y-2">
              {(
                [
                  ["pressure", "pressure"],
                  ["head", "head"],
                  ["demand", "demand"],
                  ["waterQuality", "simulationSettings.waterQuality"],
                ] as [keyof NodeFields, string][]
              ).map(([key, translationKey]) => {
                const disabled =
                  key === "waterQuality" && !isWaterQualityEnabled;
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-x-2 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      checked={nodeFields[key]}
                      disabled={disabled}
                      onChange={(e) =>
                        setNodeFields((prev) => ({
                          ...prev,
                          [key]: e.target.checked,
                        }))
                      }
                      className="rounded text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-700">
                      {translate(translationKey)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-x-2 cursor-pointer">
              <IndeterminateCheckbox
                checked={linkAllChecked}
                indeterminate={linkIndeterminate}
                onChange={toggleAllLinks}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-900">
                {translate("links")}
              </span>
            </label>
            <div className="pl-5 space-y-2">
              {(
                [
                  ["status", "status"],
                  ["flow", "flow"],
                  ["velocity", "velocity"],
                  ["unitHeadloss", "unitHeadloss"],
                ] as [keyof LinkFields, string][]
              ).map(([key, translationKey]) => (
                <label
                  key={key}
                  className="flex items-center gap-x-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={linkFields[key]}
                    onChange={(e) =>
                      setLinkFields((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">
                    {translate(translationKey)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {showSizeWarning && (
          <div
            className={`p-3 rounded-md space-y-1 ${
              exceedsLimit
                ? "bg-red-50 border border-red-200"
                : "bg-yellow-50 border border-yellow-200"
            }`}
          >
            <p
              className={`text-sm font-medium ${exceedsLimit ? "text-red-800" : "text-yellow-800"}`}
            >
              {translate(
                exceedsLimit
                  ? "exportTimeSeries.exceededSizeTitle"
                  : "exportTimeSeries.largeExportTitle",
                estimatedGB.toFixed(1),
              )}
            </p>
            <p
              className={`text-sm ${exceedsLimit ? "text-red-800" : "text-yellow-800"}`}
            >
              {translate(
                exceedsLimit
                  ? "exportTimeSeries.exceededSizeExportDescription"
                  : "exportTimeSeries.largeExportDescription",
              )}
            </p>
          </div>
        )}
      </div>
    </BaseDialog>
  );
};
