import { useAtomValue } from "jotai";
import { AssetEditor } from "./AssetEditor";
import React from "react";
import { NothingSelected } from "src/components/nothing_selected";
import { dataAtom, selectedFeaturesAtom } from "src/state/jotai";
import MultiAssetViewer from "./MultiAssetViewer";

export default function FeatureEditor() {
  const selectedFeatures = useAtomValue(selectedFeaturesAtom);
  const {
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);

  const content =
    selectedFeatures.length > 1 ? (
      <MultiAssetViewer
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
