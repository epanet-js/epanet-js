import { IWrappedFeature } from "src/types";
import { extractMultiProperties } from "src/lib/multi_properties";
import { useRef } from "react";
import sortBy from "lodash/sortBy";
import { PanelDetails } from "../panel_details";
import { pluralize } from "src/lib/utils";
import { onArrow } from "src/lib/arrow_navigation";
import { PropertyTableHead } from "./AssetEditor";
import { translate } from "src/infra/i18n";
import { PropertyRowMulti } from "./feature_editor/property_row";

export default function MultiAssetEditor({
  selectedFeatures,
}: {
  selectedFeatures: IWrappedFeature[];
}) {
  return (
    <>
      <div className="overflow-auto">
        <FeatureEditorPropertiesMulti selectedFeatures={selectedFeatures} />
      </div>
      <div className="flex-auto" />
      <div className="divide-y divide-gray-200 dark:divide-gray-900 border-t border-gray-200 dark:border-gray-900 overflow-auto placemark-scrollbar"></div>
    </>
  );
}

export function FeatureEditorPropertiesMulti({
  selectedFeatures,
}: {
  selectedFeatures: IWrappedFeature[];
}) {
  const propertyMap = extractMultiProperties(selectedFeatures);
  const localOrder = useRef<PropertyKey[]>(Array.from(propertyMap.keys()));

  const pairs = sortBy(Array.from(propertyMap.entries()), ([key]) =>
    localOrder.current.indexOf(key),
  );

  return (
    <PanelDetails
      title={`${pluralize("asset", selectedFeatures.length)}`}
      variant="fullwidth"
    >
      <table className="ppb-2 b-2 w-full" data-focus-scope onKeyDown={onArrow}>
        <PropertyTableHead />
        <tbody>
          {pairs.map((pair, y) => {
            const label = translate(pair[0]);
            const value = pair[1];
            return (
              <PropertyRowMulti
                y={y}
                key={label}
                pair={[label, value]}
                even={y % 2 === 0}
                onChangeValue={() => {}}
                onChangeKey={() => {}}
                onDeleteKey={() => {}}
                onCast={() => {}}
              />
            );
          })}
        </tbody>
      </table>
    </PanelDetails>
  );
}
