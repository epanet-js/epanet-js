import type { IWrappedFeature } from "src/types";
import { FeatureEditorProperties } from "./feature_editor_properties";
import { FeatureEditorId } from "./feature_editor_id";
import React from "react";
import { RawEditor } from "./raw_editor";
import {
  Asset,
  AssetExplain,
  AssetQuantities,
  AssetQuantitiesSpecByType,
  AssetStatus,
  Junction,
  Pipe,
  canonicalQuantitiesSpec,
  getQuantitySpec,
} from "src/hydraulic-model";
import { PanelDetails } from "src/components/panel_details";
import { localizeDecimal, translate, translateUnit } from "src/infra/i18n";
import { onArrow } from "src/lib/arrow_navigation";
import { PropertyRow } from "./property_row";
import { isDebugOn } from "src/infra/debug-mode";
import { QuantitiesSpec, Quantity, Unit, convertTo } from "src/quantity";

import { isFeatureOn } from "src/infra/feature-flags";
import { presets as quantityPresets } from "src/settings/quantities-spec";
import { BaseAsset } from "src/hydraulic-model";
import {
  JunctionQuantities,
  junctionCanonicalSpec,
} from "src/hydraulic-model/asset-types/junction";
import {
  PipeQuantities,
  pipeCanonicalSpec,
} from "src/hydraulic-model/asset-types/pipe";

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
  const systemSpec = isFeatureOn("FLAG_US_CUSTOMARY")
    ? quantityPresets.usCustomary
    : canonicalQuantitiesSpec;

  if (isFeatureOn("FLAG_ASSET_RESULTS") && asset.type === "junction") {
    return (
      <JunctionEditor
        junction={asset as Junction}
        quantitiesSpec={
          systemSpec.junction as QuantitiesSpec<JunctionQuantities>
        }
      />
    );
  }
  if (isFeatureOn("FLAG_ASSET_RESULTS") && asset.type === "pipe") {
    return (
      <PipeEditor
        pipe={asset as Pipe}
        quantitiesSpec={systemSpec.pipe as QuantitiesSpec<PipeQuantities>}
      />
    );
  }

  return <AssetPropertiesEditor asset={asset} systemSpec={systemSpec} />;
};

const PipeEditor = ({
  pipe,
  quantitiesSpec,
}: {
  pipe: Pipe;
  quantitiesSpec: QuantitiesSpec<PipeQuantities>;
}) => {
  return (
    <PanelDetails title={translate("pipe")} variant="fullwidth">
      <div className="pb-3 contain-layout">
        <div className="overflow-y-auto placemark-scrollbar" data-focus-scope>
          <table className="pb-2 w-full">
            <PropertyTableHead />
            <tbody>
              <StatusRow name={"status"} status={pipe.status} position={0} />
              <QuantityRow
                name="diameter"
                position={1}
                value={pipe.diameter}
                fromUnit={pipeCanonicalSpec.diameter.unit}
                toUnit={quantitiesSpec.diameter.unit}
                decimals={quantitiesSpec.diameter.decimals}
              />
              <QuantityRow
                name="length"
                position={2}
                value={pipe.length}
                fromUnit={pipeCanonicalSpec.length.unit}
                toUnit={quantitiesSpec.length.unit}
                decimals={quantitiesSpec.length.decimals}
              />
              <QuantityRow
                name="roughness"
                position={3}
                value={pipe.roughness}
                fromUnit={pipeCanonicalSpec.roughness.unit}
                toUnit={quantitiesSpec.roughness.unit}
                decimals={quantitiesSpec.roughness.decimals}
              />
              <QuantityRow
                name="minorLoss"
                position={4}
                value={pipe.minorLoss}
                fromUnit={pipeCanonicalSpec.minorLoss.unit}
                toUnit={quantitiesSpec.minorLoss.unit}
                decimals={quantitiesSpec.minorLoss.decimals}
              />
              <QuantityRow
                name="flow"
                position={5}
                value={pipe.flow}
                fromUnit={pipeCanonicalSpec.flow.unit}
                toUnit={quantitiesSpec.flow.unit}
                decimals={quantitiesSpec.flow.decimals}
              />
            </tbody>
          </table>
        </div>
      </div>
    </PanelDetails>
  );
};

const JunctionEditor = ({
  junction,
  quantitiesSpec,
}: {
  junction: Junction;
  quantitiesSpec: QuantitiesSpec<JunctionQuantities>;
}) => {
  return (
    <PanelDetails title={translate("junction")} variant="fullwidth">
      <div className="pb-3 contain-layout">
        <div className="overflow-y-auto placemark-scrollbar" data-focus-scope>
          <table className="pb-2 w-full">
            <PropertyTableHead />
            <tbody>
              <QuantityRow
                name="elevation"
                position={0}
                value={junction.elevation}
                fromUnit={junctionCanonicalSpec.elevation.unit}
                toUnit={quantitiesSpec.elevation.unit}
                decimals={quantitiesSpec.elevation.decimals}
              />
              <QuantityRow
                name="demand"
                position={1}
                value={junction.demand}
                fromUnit={junctionCanonicalSpec.demand.unit}
                toUnit={quantitiesSpec.demand.unit}
                decimals={quantitiesSpec.demand.decimals}
              />
              <QuantityRow
                name="pressure"
                position={2}
                value={junction.pressure}
                fromUnit={junctionCanonicalSpec.pressure.unit}
                toUnit={quantitiesSpec.pressure.unit}
                decimals={quantitiesSpec.pressure.decimals}
              />
            </tbody>
          </table>
        </div>
      </div>
    </PanelDetails>
  );
};

export function AssetPropertiesEditor({
  asset,
  systemSpec,
}: {
  asset: Asset;
  systemSpec: AssetQuantitiesSpecByType;
}) {
  const properties = asset.explainDeprecated() as AssetExplain;

  return (
    <PanelDetails title={translate(asset.type)} variant="fullwidth">
      <div className="pb-3 contain-layout">
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
                    <QuantityPropertyRowDeprecated
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
                    <StatusRow
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
      </div>
    </PanelDetails>
  );
}

const StatusRow = ({
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

const QuantityRow = ({
  name,
  value,
  fromUnit,
  toUnit,
  decimals,
  position,
}: {
  name: string;
  value: number | null;
  fromUnit: Unit;
  toUnit: Unit;
  position: number;
  decimals?: number;
}) => {
  const displayValue =
    value === null
      ? translate("notAvailable")
      : localizeDecimal(convertTo({ value, unit: fromUnit }, toUnit), decimals);

  const label = toUnit
    ? `${translate(name)} (${translateUnit(toUnit)})`
    : `${translate(name)}`;
  return (
    <PropertyRow
      pair={[label, displayValue]}
      y={position}
      even={position % 2 === 0}
      onChangeValue={() => {}}
      onChangeKey={() => {}}
      onDeleteKey={() => {}}
      onCast={() => {}}
    />
  );
};

const QuantityPropertyRowDeprecated = ({
  name,
  attribute,
  unit,
  decimals,
  position,
}: {
  name: string;
  attribute: { value: number | null; unit: Unit };
  unit: Unit;
  position: number;
  decimals?: number;
}) => {
  const value =
    attribute.value === null
      ? "N/A"
      : localizeDecimal(convertTo(attribute as Quantity, unit), decimals);

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
