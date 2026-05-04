import { memo, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { TabRoot, TabList, Tab } from "src/components/tab";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import type { AssetType } from "src/hydraulic-model/asset-types/types";
import { useTranslate } from "src/hooks/use-translate";
import { AssetDataTable } from "./asset-data-table";

const ASSET_TYPES: AssetType[] = [
  "junction",
  "pipe",
  "pump",
  "valve",
  "reservoir",
  "tank",
];

const ASSET_TYPE_TAB_KEY: Record<AssetType, string> = {
  junction: "junctions",
  pipe: "pipes",
  pump: "pumps",
  valve: "valves",
  reservoir: "reservoirs",
  tank: "tanks",
};

export const DataTablesPanel = memo(function DataTablesPanelInner() {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const translate = useTranslate();

  const presentTypes = useMemo(() => {
    const typesWithAssets = new Set<AssetType>();
    for (const asset of hydraulicModel.assets.values()) {
      typesWithAssets.add(asset.type as AssetType);
    }
    return ASSET_TYPES.filter((t) => typesWithAssets.has(t));
  }, [hydraulicModel.assets]);

  const [activeTab, setActiveTab] = useState<AssetType | null>(
    () => presentTypes[0] ?? null,
  );

  const effectiveTab = useMemo(() => {
    const typesWithAssets = new Set(presentTypes);
    return activeTab && typesWithAssets.has(activeTab)
      ? activeTab
      : (presentTypes[0] ?? null);
  }, [activeTab, presentTypes]);

  if (presentTypes.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 dark:text-gray-600">
        No assets in network
      </div>
    );
  }

  return (
    <TabRoot
      className="absolute inset-0 flex flex-col"
      value={effectiveTab ?? undefined}
      onValueChange={(v) => setActiveTab(v as AssetType)}
    >
      <TabList>
        {presentTypes.map((type) => (
          <Tab key={type} value={type}>
            {translate(ASSET_TYPE_TAB_KEY[type])}
          </Tab>
        ))}
      </TabList>
      {effectiveTab && (
        <AssetDataTable key={effectiveTab} assetType={effectiveTab} />
      )}
    </TabRoot>
  );
});
