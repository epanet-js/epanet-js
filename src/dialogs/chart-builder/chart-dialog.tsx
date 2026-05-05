import { useState } from "react";
import clsx from "clsx";
import { BaseDialog } from "src/components/dialog";
import { ChartStep } from "./steps/chart-step";
import { ChartTableStep } from "./steps/chart-table-step";

type Tab = "graph" | "table";

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
  const [activeTab, setActiveTab] = useState<Tab>("graph");

  return (
    <BaseDialog
      title={chartTitle}
      size="fullscreen"
      height="xxl"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="flex flex-col flex-1 min-h-0 px-2 py-4">
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "graph" ? (
          <ChartStep
            selectedAssetIds={selectedAssetIds}
            nodeProperty={nodeProperty}
            linkProperty={linkProperty}
          />
        ) : (
          <ChartTableStep
            selectedAssetIds={selectedAssetIds}
            nodeProperty={nodeProperty}
            linkProperty={linkProperty}
          />
        )}
      </div>
    </BaseDialog>
  );
}

const TabBar = ({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) => (
  <div
    role="tablist"
    className="flex h-8 border-b border-gray-200 dark:border-black px-4 -mx-4 mb-4"
  >
    <TabButton
      label="Graph"
      isActive={activeTab === "graph"}
      onClick={() => onTabChange("graph")}
    />
    <TabButton
      label="Table"
      isActive={activeTab === "table"}
      onClick={() => onTabChange("table")}
    />
  </div>
);

const TabButton = ({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    role="tab"
    aria-selected={isActive}
    onClick={onClick}
    className={clsx(
      "text-sm py-1 px-3 focus:outline-none border-t border-l border-b last:border-r border-gray-200",
      isActive
        ? "text-black dark:text-white border-b-white -mb-px"
        : "text-gray-500 dark:text-gray-400 border-b-transparent hover:text-black dark:hover:text-gray-200 bg-gray-100",
    )}
  >
    {label}
  </button>
);
