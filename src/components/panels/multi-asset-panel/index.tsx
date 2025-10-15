import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { MultiAssetPanel } from "./multi-asset-panel";
import { MultiAssetPanel as MultiAssetPanelDeprecated } from "./multi-asset-panel-deprecated";
import { IWrappedFeature } from "src/types";
import { Quantities } from "src/model-metadata/quantities-spec";

export function MultiAssetPanelWrapper({
  selectedFeatures,
  quantitiesMetadata,
}: {
  selectedFeatures: IWrappedFeature[];
  quantitiesMetadata: Quantities;
}) {
  const isMultiAssetOn = useFeatureFlag("FLAG_MULTI_ASSET");

  if (isMultiAssetOn) {
    return (
      <MultiAssetPanel
        selectedFeatures={selectedFeatures}
        quantitiesMetadata={quantitiesMetadata}
      />
    );
  }

  return (
    <MultiAssetPanelDeprecated
      selectedFeatures={selectedFeatures}
      quantitiesMetadata={quantitiesMetadata}
    />
  );
}

export { MultiAssetPanelWrapper as MultiAssetPanel };
