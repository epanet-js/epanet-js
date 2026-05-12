import { BaseDialog } from "src/components/dialog";
import { Button } from "src/components/elements";
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
