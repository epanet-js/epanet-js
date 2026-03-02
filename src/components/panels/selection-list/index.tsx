import { memo } from "react";

export const SelectionListPanel = memo(function SelectionListPanelInner() {
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="px-4 py-3 text-sm font-bold border-b border-gray-200 dark:border-gray-900 text-gray-900 dark:text-white">
        Selection
      </div>
      <div className="flex-auto flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
        Coming soon
      </div>
    </div>
  );
});
