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
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";

export default function FeatureEditor() {
  const selectedFeatures = useAtomValue(selectedFeaturesDerivedAtom);
  const selection = useAtomValue(selectionAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const isEditionBlocked = useIsEditionBlocked();

  if (selection.type === "singleCustomerPoint") {
    return <CustomerPointPanel />;
  }

  if (selectedFeatures.length > 1) {
    return (
      <MultiAssetPanel
        selectedFeatures={selectedFeatures}
        readonly={isEditionBlocked}
      />
    );
  }

  if (selectedFeatures.length === 1) {
    return (
      <AssetPanel
        units={units}
        asset={selectedFeatures[0] as Asset}
        readonly={isEditionBlocked}
      />
    );
  }

  return <NothingSelected />;
}
