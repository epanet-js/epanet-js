import { useAtomValue } from "jotai";
import React from "react";
import { NothingSelected } from "src/components/nothing-selected";
import { projectSettingsAtom } from "src/state/project-settings";
import { selectedFeaturesAtom, selectionAtom } from "src/state/selection";
import { selectedFeaturesDerivedAtom } from "src/state/derived-branch-state";
import { MultiAssetPanel } from "./multi-asset-panel";
import { AssetPanel } from "./asset-panel";
import { CustomerPointPanel } from "./customer-point-panel";
import { Asset } from "src/hydraulic-model";
import { useIsSnapshotLocked } from "src/hooks/use-is-snapshot-locked";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export default function FeatureEditor() {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const selectedFeatures = useAtomValue(
    isStateRefactorOn ? selectedFeaturesDerivedAtom : selectedFeaturesAtom,
  );
  const selection = useAtomValue(selectionAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const isSnapshotLocked = useIsSnapshotLocked();

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

  return content;
}
