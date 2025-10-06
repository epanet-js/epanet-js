import { useAtomValue } from "jotai";
import { AssetEditor } from "./asset-editor";
import React from "react";
import { NothingSelected } from "src/components/nothing-selected";
import { dataAtom, selectedFeaturesAtom } from "src/state/jotai";
import MultiAssetViewer from "./multi-asset-viewer";
import { MultiAssetPanel } from "./multi-asset-panel";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export default function FeatureEditor() {
  const selectedFeatures = useAtomValue(selectedFeaturesAtom);
  const {
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);
  const isAssetPanelOn = useFeatureFlag("FLAG_ASSET_PANEL");

  const content =
    selectedFeatures.length > 1 ? (
      isAssetPanelOn ? (
        <MultiAssetPanel
          selectedFeatures={selectedFeatures}
          quantitiesMetadata={quantities}
        />
      ) : (
        <MultiAssetViewer
          selectedFeatures={selectedFeatures}
          quantitiesMetadata={quantities}
        />
      )
    ) : selectedFeatures.length === 1 ? (
      <AssetEditor
        quantitiesMetadata={quantities}
        selectedFeature={selectedFeatures[0]}
      />
    ) : (
      <NothingSelected />
    );

  return content;
}
