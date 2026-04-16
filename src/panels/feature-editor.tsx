import { useAtomValue } from "jotai";
import React from "react";
import { NothingSelected } from "src/components/nothing-selected";
import { projectSettingsAtom } from "src/state/project-settings";
import { selectionAtom } from "src/state/selection";
import { selectedFeaturesDerivedAtom } from "src/state/derived-branch-state";
import { MultiAssetPanel } from "./multi-asset-panel";
import { AssetPanel } from "./asset-panel";
import { CustomerPointPanel } from "./customer-point-panel";
import { Asset } from "src/hydraulic-model";
import { useIsSnapshotLocked } from "src/hooks/use-is-snapshot-locked";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { AssetSearch } from "./asset-panel/asset-search";

export default function FeatureEditor() {
  const selectedFeatures = useAtomValue(selectedFeaturesDerivedAtom);
  const selection = useAtomValue(selectionAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const isSnapshotLocked = useIsSnapshotLocked();
  const isAssetSearchOn = useFeatureFlag("FLAG_ASSET_SEARCH");

  if (selection.type === "singleCustomerPoint") {
    return <CustomerPointPanel />;
  }

  const content =
    selectedFeatures.length > 1 ? (
      <MultiAssetPanel
        selectedFeatures={selectedFeatures}
        readonly={isSnapshotLocked}
      />
    ) : selectedFeatures.length === 1 ? (
      <AssetPanel
        units={units}
        asset={selectedFeatures[0] as Asset}
        readonly={isSnapshotLocked}
      />
    ) : (
      <NothingSelected />
    );

  return (
    <div className="flex flex-col flex-auto overflow-hidden">
      {isAssetSearchOn && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-900">
          <AssetSearch />
        </div>
      )}
      <div className="flex-auto overflow-auto">{content}</div>
    </div>
  );
}
