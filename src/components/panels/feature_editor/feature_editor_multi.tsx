import { IWrappedFeature } from "src/types";
import {
  FeatureEditorPropertiesMulti,
  FeatureEditorPropertiesMultiDeprecated,
} from "./feature_editor_properties_multi";
import { isFeatureOn } from "src/infra/feature-flags";

export default function FeatureEditorMulti({
  selectedFeatures,
}: {
  selectedFeatures: IWrappedFeature[];
}) {
  return (
    <>
      <div className="overflow-auto">
        {isFeatureOn("FLAG_MULTI_ASSETS") && (
          <FeatureEditorPropertiesMulti selectedFeatures={selectedFeatures} />
        )}
        {!isFeatureOn("FLAG_MULTI_ASSETS") && (
          <FeatureEditorPropertiesMultiDeprecated
            selectedFeatures={selectedFeatures}
          />
        )}
      </div>
      <div className="flex-auto" />
      <div className="divide-y divide-gray-200 dark:divide-gray-900 border-t border-gray-200 dark:border-gray-900 overflow-auto placemark-scrollbar"></div>
    </>
  );
}
