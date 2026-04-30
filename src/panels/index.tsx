import React, { memo } from "react";
import { dialogAtom } from "src/state/dialog";
import {
  bottomPanelViewAtom,
  BottomPanelView,
  splitsAtom,
  TabOption,
  tabAtom,
} from "src/state/layout";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";

import FeatureEditor from "./feature-editor";
import { DefaultErrorBoundary } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { MapStylingEditor } from "./map-styling-editor";
import { NetworkReview } from "./network-review";
import { BottomResizer } from "src/components/resizer";
import { DataTablesPanel } from "./data-tables";
import { ProfileViewPanel } from "./profile-view";

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
    case TabOption.Map:
      return <MapStylingEditor />;
  }
});

const TabList = memo(function TabList({
  setTab,
  activeTab,
}: {
  activeTab: TabOption;
  setTab: React.Dispatch<React.SetStateAction<TabOption>>;
}) {
  const translate = useTranslate();
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
        onClick={() => setTab(TabOption.Map)}
        active={activeTab === TabOption.Map}
        label={translate("map")}
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

export const RelocatedSidePanel = memo(function RelocatedSidePanelInner() {
  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-900 relative flex-auto min-h-0">
      <Panel />
    </div>
  );
});

export const BottomPanel = memo(function BottomPanelInner() {
  const splits = useAtomValue(splitsAtom);
  const isProfileViewOn = useFeatureFlag("FLAG_PROFILE_VIEW");
  const [view, setView] = useAtom(bottomPanelViewAtom);

  if (!splits.bottomOpen) return null;

  // TEMP: remove with panel registry migration
  const showSwitch = isProfileViewOn;
  const activeView: BottomPanelView = isProfileViewOn ? view : "dataTables";

  return (
    <div
      style={{ height: splits.bottom }}
      className="relative flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-900 flex flex-col"
    >
      <BottomResizer />
      {showSwitch && <BottomPanelViewSwitch value={view} onChange={setView} />}
      <div className="flex-1 min-h-0 relative">
        {activeView === "profileView" ? (
          <ProfileViewPanel />
        ) : (
          <DataTablesPanel />
        )}
      </div>
    </div>
  );
});

// TEMP: remove with panel registry migration
const BottomPanelViewSwitch = memo(function BottomPanelViewSwitch({
  value,
  onChange,
}: {
  value: BottomPanelView;
  onChange: (v: BottomPanelView) => void;
}) {
  return (
    <div className="flex-none flex items-center gap-1 px-2 h-7 border-b border-gray-200 dark:border-gray-900 text-xs">
      <SwitchPill
        selected={value === "dataTables"}
        onClick={() => onChange("dataTables")}
      >
        Tables
      </SwitchPill>
      <SwitchPill
        selected={value === "profileView"}
        onClick={() => onChange("profileView")}
      >
        Profile
      </SwitchPill>
      <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-400">
        temp
      </span>
    </div>
  );
});

// TEMP: remove with panel registry migration
const SwitchPill = ({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={clsx(
      "px-2 py-0.5 rounded text-xs",
      selected
        ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-200",
    )}
  >
    {children}
  </button>
);

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

export const LeftSidePanel = memo(function LeftSidePanelInner() {
  const splits = useAtomValue(splitsAtom);
  if (!splits.leftOpen) return null;
  return (
    <div
      style={{
        width: splits.left,
      }}
      className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-900 relative"
    >
      <NetworkReview />
    </div>
  );
});
