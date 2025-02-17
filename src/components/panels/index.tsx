import { memo } from "react";
import {
  showPanelBottomAtom,
  splitsAtom,
  TabOption,
  tabAtom,
  dialogAtom,
} from "src/state/jotai";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";

import FeatureEditor from "src/components/panels/feature_editor";
import { DefaultErrorBoundary } from "src/components/elements";
import { translate } from "src/infra/i18n";
import { AnalysisEditor } from "./AnalysisEditor";

function Tab({
  onClick,
  active,
  label,
  ...attributes
}: {
  onClick: () => void;
  active: boolean;
  label: React.ReactNode;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      role="tab"
      onClick={onClick}
      aria-selected={active}
      className={clsx(
        "text-left text-sm py-1 px-3 focus:outline-none",
        active
          ? "text-black dark:text-white"
          : `
          bg-gray-100 dark:bg-gray-900
          border-b
          border-gray-200 dark:border-black
          text-gray-500 dark:text-gray-400
          hover:text-black dark:hover:text-gray-200
          focus:text-black`,
      )}
      {...attributes}
    >
      {label}
    </button>
  );
}

const ActiveTab = memo(function ActiveTab({
  activeTab,
}: {
  activeTab: TabOption;
}) {
  switch (activeTab) {
    case TabOption.Asset:
      return <FeatureEditor />;
    case TabOption.Analysis:
      return <AnalysisEditor />;
  }
});

const TabList = memo(function TabList({
  setTab,
  activeTab,
}: {
  activeTab: TabOption;
  setTab: React.Dispatch<React.SetStateAction<TabOption>>;
}) {
  return (
    <div
      role="tablist"
      style={{
        gridTemplateColumns: `repeat(2, 1fr) min-content`,
      }}
      className="flex-0 grid h-8 flex-none
      sticky top-0 z-10
      bg-white dark:bg-gray-800
      divide-x divide-gray-200 dark:divide-black"
    >
      <Tab
        onClick={() => setTab(TabOption.Asset)}
        active={activeTab === TabOption.Asset}
        label={translate("asset")}
      />
      <Tab
        onClick={() => setTab(TabOption.Analysis)}
        active={activeTab === TabOption.Analysis}
        label={translate("analysis")}
      />
    </div>
  );
});

export const SidePanel = memo(function SidePanelInner() {
  const splits = useAtomValue(splitsAtom);
  if (!splits.rightOpen) return null;
  return (
    <div
      style={{
        width: splits.right,
      }}
      className="bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-900 relative"
    >
      <Panel />
    </div>
  );
});

export const BottomPanel = memo(function BottomPanelInner() {
  const splits = useAtomValue(splitsAtom);
  const showPanel = useAtomValue(showPanelBottomAtom);
  if (!showPanel) return null;
  return (
    <div
      style={{
        height: splits.bottom,
      }}
      className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-900 relative"
    >
      <Panel />
    </div>
  );
});

export const FullPanel = memo(function FullPanelInner() {
  return (
    <div className="flex flex-auto bg-white dark:bg-gray-800 relative">
      <Panel />
    </div>
  );
});

export const Panel = memo(function PanelInner() {
  const [activeTab, setTab] = useAtom(tabAtom);
  const dialog = useAtomValue(dialogAtom);

  if (dialog && dialog.type === "welcome") return null;

  return (
    <div className="absolute inset-0 flex flex-col">
      <TabList activeTab={activeTab} setTab={setTab} />
      <DefaultErrorBoundary>
        <ActiveTab activeTab={activeTab} />
      </DefaultErrorBoundary>
    </div>
  );
});
