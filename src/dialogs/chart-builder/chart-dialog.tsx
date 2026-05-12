import { useState, useMemo } from "react";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { BaseDialog } from "src/components/dialog";
import { Button } from "src/components/elements";
import { classifyAssetTypes } from "./property-config";
import type { AssetType } from "src/hydraulic-model/asset-types";
import { ChartStep } from "./steps/chart-step";

type ChartType = "line" | "variability";
type AssetGroup = "nodes" | "links" | "all";

interface ChartBuilderChartDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssetIds: number[];
  nodeProperty: string | null;
  linkProperty: string | null;
  chartTitle: string;
  chartType: ChartType;
}

export function ChartBuilderChartDialog({
  isOpen,
  onClose,
  selectedAssetIds,
  nodeProperty,
  linkProperty,
  chartTitle,
  chartType: initialChartType,
}: ChartBuilderChartDialogProps) {
  const [chartType, setChartType] = useState<ChartType>(initialChartType);
  const [assetGroup, setAssetGroup] = useState<AssetGroup>(
    initialChartType === "variability" ? "nodes" : "all",
  );

  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const isMixed = useMemo(() => {
    const types = selectedAssetIds.flatMap((id) => {
      const asset = hydraulicModel.assets.get(id);
      return asset ? [asset.type as AssetType] : [];
    });
    const c = classifyAssetTypes(types);
    return c.hasNodes && c.hasLinks;
  }, [selectedAssetIds, hydraulicModel.assets]);

  const handleChartTypeChange = (type: ChartType) => {
    setChartType(type);
    if (type === "line") setAssetGroup("all");
    else if (assetGroup === "all") setAssetGroup("nodes");
  };

  return (
    <BaseDialog
      title={chartTitle}
      size="xl"
      height="xl"
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <footer className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <Button type="button" variant="default" onClick={onClose}>
            Close
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="default" onClick={() => {}}>
              Save as PNG
            </Button>
            <Button type="button" variant="default" onClick={() => {}}>
              Export CSV
            </Button>
          </div>
        </footer>
      }
    >
      <div className="flex flex-col flex-1 min-h-0 px-2 py-4 gap-3">
        {selectedAssetIds.length >= 2 && (
          <div className="flex justify-center gap-3">
            <ChartTypeToggle
              value={chartType}
              onChange={handleChartTypeChange}
            />
            {isMixed && (
              <AssetGroupToggle
                value={assetGroup}
                onChange={setAssetGroup}
                allDisabled={chartType === "variability"}
              />
            )}
          </div>
        )}
        <ChartStep
          selectedAssetIds={selectedAssetIds}
          nodeProperty={nodeProperty}
          linkProperty={linkProperty}
          chartType={chartType}
          assetGroup={assetGroup}
        />
      </div>
    </BaseDialog>
  );
}

function ChartTypeToggle({
  value,
  onChange,
}: {
  value: ChartType;
  onChange: (v: ChartType) => void;
}) {
  return (
    <SegmentedToggle
      options={[
        { value: "variability", label: "Variability" },
        { value: "line", label: "Line" },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

function AssetGroupToggle({
  value,
  onChange,
  allDisabled,
}: {
  value: AssetGroup;
  onChange: (v: AssetGroup) => void;
  allDisabled: boolean;
}) {
  return (
    <SegmentedToggle
      options={[
        { value: "nodes", label: "Nodes" },
        { value: "links", label: "Links" },
        { value: "all", label: "All", disabled: allDisabled },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded border border-gray-200 overflow-hidden text-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={opt.disabled}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "px-3 py-1 transition-colors",
            opt.disabled
              ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
              : value === opt.value
                ? "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white font-medium"
                : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
