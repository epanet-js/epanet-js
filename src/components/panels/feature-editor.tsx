import { useAtomValue } from "jotai";
import React from "react";
import { NothingSelected } from "src/components/nothing-selected";
import { dataAtom, selectedFeaturesAtom } from "src/state/jotai";
import { MultiAssetPanel } from "./multi-asset-panel";
import { AssetPanel } from "./asset-panel";
import { Asset } from "src/hydraulic-model";
import { useIsMainReadonly } from "src/hooks/use-is-main-readonly";

export default function FeatureEditor() {
  const selectedFeatures = useAtomValue(selectedFeaturesAtom);
  const {
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);
  const isMainReadonly = useIsMainReadonly();

  const content =
    selectedFeatures.length > 1 ? (
      <MultiAssetPanel
        selectedFeatures={selectedFeatures}
        quantitiesMetadata={quantities}
        readonly={isMainReadonly}
      />
    ) : selectedFeatures.length === 1 ? (
      <AssetPanel
        quantitiesMetadata={quantities}
        asset={selectedFeatures[0] as Asset}
        readonly={isMainReadonly}
      />
    ) : (
      <NothingSelected />
    );

  return content;
}
