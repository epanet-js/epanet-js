import { useAtomValue } from "jotai";
import React from "react";
import { NothingSelected } from "src/components/nothing-selected";
import { dataAtom, selectedFeaturesAtom } from "src/state/jotai";
import { MultiAssetPanel, BatchEditMultiAssetPanel } from "./multi-asset-panel";
import { AssetPanel } from "./asset-panel";
import { Asset } from "src/hydraulic-model";
import { useIsSnapshotLocked } from "src/hooks/use-is-snapshot-locked";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export default function FeatureEditor() {
  const selectedFeatures = useAtomValue(selectedFeaturesAtom);
  const {
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);
  const isSnapshotLocked = useIsSnapshotLocked();
  const isBatchEditEnabled = useFeatureFlag("FLAG_BATCH_EDIT");

  const content =
    selectedFeatures.length > 1 ? (
      isBatchEditEnabled ? (
        <BatchEditMultiAssetPanel
          selectedFeatures={selectedFeatures}
          quantitiesMetadata={quantities}
          readonly={isSnapshotLocked}
        />
      ) : (
        <MultiAssetPanel
          selectedFeatures={selectedFeatures}
          quantitiesMetadata={quantities}
          readonly={isSnapshotLocked}
        />
      )
    ) : selectedFeatures.length === 1 ? (
      <AssetPanel
        quantitiesMetadata={quantities}
        asset={selectedFeatures[0] as Asset}
        readonly={isSnapshotLocked}
      />
    ) : (
      <NothingSelected />
    );

  return content;
}
