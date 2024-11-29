import type { IWrappedFeature } from "src/types";
import { FeatureEditorProperties } from "./feature_editor_properties";
import { FeatureEditorId } from "./feature_editor_id";
import React from "react";
import { RawEditor } from "./raw_editor";
import {
  Asset,
  AssetExplain,
  AssetQuantities,
  AssetStatus,
  getQuantitySpec,
} from "src/hydraulic-model";
import { PanelDetails } from "src/components/panel_details";
import { localizeDecimal, translate, translateUnit } from "src/infra/i18n";
import { onArrow } from "src/lib/arrow_navigation";
import { PropertyRow } from "./property_row";
import { isDebugOn } from "src/infra/debug-mode";
import { Quantity, Unit, convertTo } from "src/quantity";

import { isFeatureOn } from "src/infra/feature-flags";
import { presets as quantityPresets } from "src/settings/quantities-spec";
import { BaseAsset } from "src/hydraulic-model";

export function FeatureEditorInner({
  selectedFeature,
}: {
  selectedFeature: IWrappedFeature;
}) {
  return (
    <>
      <div className="flex-auto overflow-y-auto placemark-scrollbar">
        {selectedFeature instanceof BaseAsset ? (
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
  const properties = asset.explain() as AssetExplain;

  const systemSpec = isFeatureOn("FLAG_US_CUSTOMARY")
    ? quantityPresets.usCustomary
    : quantityPresets.si;

  return (
    <div
      className="overflow-y-auto placemark-scrollbar"
      data-focus-scope
      onKeyDown={onArrow}
    >
      <table className="pb-2 w-full">
        <PropertyTableHead />
        <tbody>
          {Object.keys(properties).map((key, y) => {
            const property = properties[key as keyof AssetExplain];

            if (property.type === "quantity") {
              const quantitySpec = getQuantitySpec(
                systemSpec,
                asset.type,
                key as keyof AssetQuantities,
              );

              return (
                <QuantityPropertyRow
                  key={key}
                  name={key}
                  attribute={property as Quantity}
                  unit={quantitySpec.unit}
                  decimals={quantitySpec.decimals}
                  position={y}
                />
              );
            }

            if (property.type === "status") {
              return (
                <StatusPropertyRow
                  key={key}
                  name={key}
                  status={property.value}
                  position={y}
                />
              );
            }
          })}
        </tbody>
      </table>
    </div>
  );
}

const StatusPropertyRow = ({
  name,
  status,
  position,
}: {
  name: string;
  status: AssetStatus;
  position: number;
}) => {
  const label = translate(name);
  const value = translate(status);
  return (
    <PropertyRow
      pair={[label, value]}
      y={position}
      even={position % 2 === 0}
      onChangeValue={() => {}}
      onChangeKey={() => {}}
      onDeleteKey={() => {}}
      onCast={() => {}}
    />
  );
};
const QuantityPropertyRow = ({
  name,
  attribute,
  unit,
  decimals,
  position,
}: {
  name: string;
  attribute: Quantity;
  unit: Unit;
  position: number;
  decimals?: number;
}) => {
  const value = localizeDecimal(convertTo(attribute, unit), decimals);

  const label = unit
    ? `${translate(name)} (${translateUnit(unit)})`
    : `${translate(name)}`;
  return (
    <PropertyRow
      pair={[label, value]}
      y={position}
      even={position % 2 === 0}
      onChangeValue={() => {}}
      onChangeKey={() => {}}
      onDeleteKey={() => {}}
      onCast={() => {}}
    />
  );
};
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
