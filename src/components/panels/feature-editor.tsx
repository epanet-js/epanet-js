import { useAtomValue } from "jotai";
import { AssetEditor } from "./asset-editor";
import React from "react";
import { NothingSelected } from "src/components/nothing-selected";
import { dataAtom, selectedFeaturesAtom } from "src/state/jotai";
import { MultiAssetPanel } from "./multi-asset-panel";

export default function FeatureEditor() {
  const selectedFeatures = useAtomValue(selectedFeaturesAtom);
  const {
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);

  const content =
    selectedFeatures.length > 1 ? (
      <MultiAssetPanel
        selectedFeatures={selectedFeatures}
        quantitiesMetadata={quantities}
      />
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
