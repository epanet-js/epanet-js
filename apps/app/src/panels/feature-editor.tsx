import { useAtomValue } from "jotai";
import React from "react";
import { NothingSelected } from "src/components/nothing-selected";
import { projectSettingsAtom } from "src/state/project-settings";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
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

  const { assets, customerPoints } = USelection.countByKind(selection);

  if (assets === 0 && customerPoints === 0) {
    return <NothingSelected />;
  }

  if (assets === 0 && customerPoints === 1) {
    return <CustomerPointPanel />;
  }

  if (assets === 1 && customerPoints === 0) {
    return (
      <AssetPanel
        units={units}
        asset={selectedFeatures[0] as Asset}
        readonly={isEditionBlocked}
      />
    );
  }

  return (
    <MultiAssetPanel
      selectedFeatures={selectedFeatures}
      customerPointCount={customerPoints}
      readonly={isEditionBlocked}
    />
  );
}
