import { useAtomValue } from "jotai";
import { FeatureEditorInnerDeprecated } from "./feature_editor/feature_editor_inner_deprecated";
import { FeatureEditorInner } from "./feature_editor/feature_editor_inner";
import FeatureEditorMulti from "./feature_editor/feature_editor_multi";
import React from "react";
import { NothingSelected } from "src/components/nothing_selected";
import { selectedFeaturesAtom } from "src/state/jotai";
import { isFeatureOn } from "src/infra/feature-flags";

export default function FeatureEditor() {
  const selectedFeatures = useAtomValue(selectedFeaturesAtom);

  const content =
    selectedFeatures.length > 1 ? (
      <FeatureEditorMulti selectedFeatures={selectedFeatures} />
    ) : selectedFeatures.length === 1 ? (
      isFeatureOn("FLAG_DEFAULTS") ? (
        <FeatureEditorInner selectedFeature={selectedFeatures[0]} />
      ) : (
        <FeatureEditorInnerDeprecated selectedFeature={selectedFeatures[0]} />
      )
    ) : (
      <NothingSelected />
    );

  return content;
}
