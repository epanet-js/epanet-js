import { useAtomValue } from "jotai";
import React from "react";
import { NothingSelected } from "src/components/nothing-selected";
import { dataAtom, selectedFeaturesAtom, selectionAtom } from "src/state/jotai";
import { MultiAssetPanel } from "./multi-asset-panel";
import { AssetPanel } from "./asset-panel";
import { CustomerPointPanel } from "./customer-point-panel";
import { Asset } from "src/hydraulic-model";
import { useIsSnapshotLocked } from "src/hooks/use-is-snapshot-locked";

export default function FeatureEditor() {
  const selectedFeatures = useAtomValue(selectedFeaturesAtom);
  const selection = useAtomValue(selectionAtom);
  const {
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);
  const isSnapshotLocked = useIsSnapshotLocked();

  if (selection.type === "singleCustomerPoint") {
    return <CustomerPointPanel />;
  }

  const content =
    selectedFeatures.length > 1 ? (
      <MultiAssetPanel
        selectedFeatures={selectedFeatures}
        quantitiesMetadata={quantities}
        readonly={isSnapshotLocked}
      />
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
