import { useState } from "react";
import clsx from "clsx";
import { BaseDialog } from "src/components/dialog";
import { Button } from "src/components/elements";
import { ChartStep } from "./steps/chart-step";

type ChartType = "line" | "variability";

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
          <div className="flex justify-center">
            <ChartTypeToggle value={chartType} onChange={setChartType} />
          </div>
        )}
        <ChartStep
          selectedAssetIds={selectedAssetIds}
          nodeProperty={nodeProperty}
          linkProperty={linkProperty}
          chartType={chartType}
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
    <div className="flex rounded border border-gray-200 overflow-hidden text-sm">
      {(["variability", "line"] as const).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={clsx(
            "px-3 py-1 capitalize transition-colors",
            value === type
              ? "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white font-medium"
              : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200",
          )}
        >
          {type === "variability" ? "Variability" : "Line"}
        </button>
      ))}
    </div>
  );
}
