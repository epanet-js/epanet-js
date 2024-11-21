import type { IWrappedFeature } from "src/types";
import { FeatureEditorProperties } from "./feature_editor_properties";
import { FeatureEditorId } from "./feature_editor_id";
import React, { useMemo } from "react";
import { RawEditor } from "./raw_editor";
import { Asset, AssetExplain } from "src/hydraulics/asset-types";
import { PanelDetails } from "src/components/panel_details";
import { translate } from "src/infra/i18n";
import { onArrow } from "src/lib/arrow_navigation";
import { PropertyRow } from "./property_row";
import { isDebugOn } from "src/infra/debug-mode";
import { Quantity } from "src/quantity";
import {
  HeadlossFormula,
  roughnessKeyFor,
} from "src/hydraulics/asset-types/pipe";

export function FeatureEditorInner({
  selectedFeature,
}: {
  selectedFeature: IWrappedFeature;
}) {
  const assetType = selectedFeature.feature.properties?.type;
  return (
    <>
      <div className="flex-auto overflow-y-auto placemark-scrollbar">
        {!!assetType ? (
          <AssetEditor asset={selectedFeature as Asset} />
        ) : (
          <FeatureEditorProperties wrappedFeature={selectedFeature} />
        )}
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-900 border-t border-gray-200 dark:border-gray-900 overflow-auto placemark-scrollbar">
        {isDebugOn && (
          <>
            <FeatureEditorId wrappedFeature={selectedFeature} />
            <RawEditor feature={selectedFeature} />
          </>
        )}
      </div>
    </>
  );
}

const AssetEditor = ({ asset }: { asset: Asset }) => {
  return (
    <PanelDetails title={translate(asset.type)} variant="fullwidth">
      <div className="pb-3 contain-layout">
        <AssetPropertiesEditor asset={asset} />
      </div>
    </PanelDetails>
  );
};

export function AssetPropertiesEditor({ asset }: { asset: Asset }) {
  const attributes = asset.explain() as AssetExplain;

  const filteredAttributes = useMemo(() => {
    const headlossFormula: HeadlossFormula = "H-W";
    const roughnessKey = roughnessKeyFor[headlossFormula];

    const filtered = {} as AssetExplain;
    for (const attributeKey in attributes) {
      if (
        attributeKey.startsWith("roughness") &&
        attributeKey !== roughnessKey
      ) {
        continue;
      }

      filtered[attributeKey as keyof AssetExplain] =
        attributes[attributeKey as keyof AssetExplain];
    }
    return filtered;
  }, [attributes]);

  return (
    <div
      className="overflow-y-auto placemark-scrollbar"
      data-focus-scope
      onKeyDown={onArrow}
    >
      <table className="pb-2 w-full">
        <PropertyTableHead />
        <tbody>
          {Object.keys(filteredAttributes).map((key, y) => {
            const attribute = attributes[key as keyof AssetExplain] as Quantity;
            const label = attribute.unit
              ? `${translate(key)} (${attribute.unit})`
              : `${translate(key)}`;
            return (
              <PropertyRow
                key={key}
                pair={[label, attribute.value]}
                y={y}
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
    </div>
  );
}
export function PropertyTableHead() {
  return (
    <thead>
      <tr className="bg-gray-100 dark:bg-gray-800 font-sans text-gray-500 dark:text-gray-100 text-xs text-left">
        <th className="pl-3 py-2 border-r border-t border-b border-gray-200 dark:border-gray-700">
          {translate("property")}
        </th>
        <th className="pl-2 py-2 border-l border-t border-b border-gray-200 dark:border-gray-700">
          {translate("value")}
        </th>
      </tr>
    </thead>
  );
}
