import { BaseDialog } from "src/components/dialog";
import { ChartStep } from "./steps/chart-step";

interface ChartBuilderChartDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssetIds: number[];
  nodeProperty: string | null;
  linkProperty: string | null;
  chartTitle: string;
}

export function ChartBuilderChartDialog({
  isOpen,
  onClose,
  selectedAssetIds,
  nodeProperty,
  linkProperty,
  chartTitle,
}: ChartBuilderChartDialogProps) {
  return (
    <BaseDialog
      title={chartTitle}
      size="xxl"
      height="xxl"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="flex flex-col flex-1 min-h-0 px-2 py-4">
        <ChartStep
          selectedAssetIds={selectedAssetIds}
          nodeProperty={nodeProperty}
          linkProperty={linkProperty}
        />
      </div>
    </BaseDialog>
  );
}
