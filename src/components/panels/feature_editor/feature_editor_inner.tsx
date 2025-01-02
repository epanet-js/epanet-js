import type { IWrappedFeature } from "src/types";
import { FeatureEditorProperties } from "./feature_editor_properties";
import { FeatureEditorId } from "./feature_editor_id";
import React, { useCallback, useMemo } from "react";
import { RawEditor } from "./raw_editor";
import { Asset, AssetStatus, Junction, Pipe } from "src/hydraulic-model";
import { PanelDetails } from "src/components/panel_details";
import { localizeDecimal, translate, translateUnit } from "src/infra/i18n";
import { PropertyRow, PropertyRowReadonly } from "./property_row";
import { isDebugOn } from "src/infra/debug-mode";
import { Unit } from "src/quantity";

import { Quantities } from "src/model-metadata/quantities-spec";
import { BaseAsset } from "src/hydraulic-model";
import { Reservoir } from "src/hydraulic-model/asset-types/reservoir";
import { isFeatureOn } from "src/infra/feature-flags";
import { PipeStatus, pipeStatuses } from "src/hydraulic-model/asset-types/pipe";
import {
  changePipeStatus,
  changeProperty,
} from "src/hydraulic-model/model-operations";
import { useAtomValue } from "jotai";
import { dataAtom } from "src/state/jotai";
import { usePersistence } from "src/lib/persistence/context";
import { NumericField, Selector } from "./property_row/value";

export function FeatureEditorInner({
  selectedFeature,
  quantitiesMetadata,
}: {
  selectedFeature: IWrappedFeature;
  quantitiesMetadata: Quantities;
}) {
  return (
    <>
      <div className="flex-auto overflow-y-auto placemark-scrollbar">
        {selectedFeature instanceof BaseAsset ? (
          <AssetEditor
            asset={selectedFeature as Asset}
            quantitiesMetadata={quantitiesMetadata}
          />
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

export const AssetEditor = ({
  asset,
  quantitiesMetadata,
}: {
  asset: Asset;
  quantitiesMetadata: Quantities;
}) => {
  switch (asset.type) {
    case "junction":
      return (
        <JunctionEditor
          junction={asset as Junction}
          quantitiesMetadata={quantitiesMetadata}
        />
      );
    case "pipe":
      return (
        <PipeEditor
          pipe={asset as Pipe}
          quantitiesMetadata={quantitiesMetadata}
        />
      );
    case "reservoir":
      return (
        <ReservoirEditor
          reservoir={asset as Reservoir}
          quantitiesMetadata={quantitiesMetadata}
        />
      );
  }
};

const PipeEditor = ({
  pipe,
  quantitiesMetadata,
}: {
  pipe: Pipe;
  quantitiesMetadata: Quantities;
}) => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();

  const handleStatusChange = useCallback(
    (newStatus: PipeStatus) => {
      const moment = changePipeStatus(hydraulicModel, {
        pipeId: pipe.id,
        newStatus,
      });
      transact(moment);
    },
    [hydraulicModel, pipe.id, transact],
  );

  const handlePropertyChange = (name: string, value: number) => {
    const moment = changeProperty(hydraulicModel, {
      assetIds: [pipe.id],
      property: name,
      value,
    });
    transact(moment);
  };
  return (
    <PanelDetails title={translate("pipe")} variant="fullwidth">
      <div className="pb-3 contain-layout">
        <div className="overflow-y-auto placemark-scrollbar" data-focus-scope>
          <table className="pb-2 w-full">
            <PropertyTableHead />
            <tbody>
              {isFeatureOn("FLAG_EDIT_PROPS") && (
                <StatusRow
                  name={"status"}
                  status={pipe.status}
                  availableStatuses={pipeStatuses}
                  position={0}
                  onChange={handleStatusChange}
                />
              )}
              {!isFeatureOn("FLAG_EDIT_PROPS") && (
                <StatusRowDeprecated
                  name={"status"}
                  status={pipe.status}
                  position={0}
                />
              )}
              <QuantityRow
                name="diameter"
                position={1}
                value={pipe.diameter}
                unit={quantitiesMetadata.getUnit("pipe", "diameter")}
                decimals={quantitiesMetadata.getDecimals("pipe", "diameter")}
                onChange={handlePropertyChange}
              />
              <QuantityRow
                name="length"
                position={2}
                value={pipe.length}
                unit={quantitiesMetadata.getUnit("pipe", "length")}
                decimals={quantitiesMetadata.getDecimals("pipe", "length")}
                onChange={handlePropertyChange}
              />
              <QuantityRow
                name="roughness"
                position={3}
                value={pipe.roughness}
                unit={quantitiesMetadata.getUnit("pipe", "roughness")}
                decimals={quantitiesMetadata.getDecimals("pipe", "roughness")}
                onChange={handlePropertyChange}
              />
              <QuantityRow
                name="minorLoss"
                position={4}
                value={pipe.minorLoss}
                unit={quantitiesMetadata.getUnit("pipe", "minorLoss")}
                decimals={quantitiesMetadata.getDecimals("pipe", "minorLoss")}
                onChange={handlePropertyChange}
              />
              <QuantityRowDeprecated
                name="flow"
                position={5}
                value={pipe.flow}
                unit={quantitiesMetadata.getUnit("pipe", "flow")}
                decimals={quantitiesMetadata.getDecimals("pipe", "flow")}
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
  quantitiesMetadata,
}: {
  junction: Junction;
  quantitiesMetadata: Quantities;
}) => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();

  const handlePropertyChange = (name: string, value: number) => {
    const moment = changeProperty(hydraulicModel, {
      assetIds: [junction.id],
      property: name,
      value,
    });
    transact(moment);
  };
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
                unit={quantitiesMetadata.getUnit("junction", "elevation")}
                decimals={quantitiesMetadata.getDecimals(
                  "junction",
                  "elevation",
                )}
                onChange={handlePropertyChange}
              />
              <QuantityRow
                name="demand"
                position={1}
                value={junction.demand}
                unit={quantitiesMetadata.getUnit("junction", "demand")}
                decimals={quantitiesMetadata.getDecimals("junction", "demand")}
                onChange={handlePropertyChange}
              />
              <QuantityRowDeprecated
                name="pressure"
                position={2}
                value={junction.pressure}
                unit={quantitiesMetadata.getUnit("junction", "pressure")}
                decimals={quantitiesMetadata.getDecimals(
                  "junction",
                  "pressure",
                )}
              />
            </tbody>
          </table>
        </div>
      </div>
    </PanelDetails>
  );
};

const ReservoirEditor = ({
  reservoir,
  quantitiesMetadata,
}: {
  reservoir: Reservoir;
  quantitiesMetadata: Quantities;
}) => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();

  const handlePropertyChange = (name: string, value: number) => {
    const moment = changeProperty(hydraulicModel, {
      assetIds: [reservoir.id],
      property: name,
      value,
    });
    transact(moment);
  };

  return (
    <PanelDetails title={translate("reservoir")} variant="fullwidth">
      <div className="pb-3 contain-layout">
        <div className="overflow-y-auto placemark-scrollbar" data-focus-scope>
          <table className="pb-2 w-full">
            <PropertyTableHead />
            <tbody>
              <QuantityRow
                name="elevation"
                position={0}
                value={reservoir.elevation}
                unit={quantitiesMetadata.getUnit("reservoir", "elevation")}
                decimals={quantitiesMetadata.getDecimals(
                  "reservoir",
                  "elevation",
                )}
                onChange={handlePropertyChange}
              />
              <QuantityRow
                name="head"
                position={1}
                value={reservoir.head}
                unit={quantitiesMetadata.getUnit("reservoir", "head")}
                decimals={quantitiesMetadata.getDecimals("reservoir", "head")}
                onChange={handlePropertyChange}
              />
            </tbody>
          </table>
        </div>
      </div>
    </PanelDetails>
  );
};

const StatusRow = ({
  name,
  status,
  availableStatuses,
  position,
  onChange,
}: {
  name: string;
  status: AssetStatus;
  availableStatuses: readonly AssetStatus[];
  position: number;
  onChange: (newStatus: AssetStatus) => void;
}) => {
  const label = translate(name);
  const value = translate(status);

  const { selected, options } = useMemo(() => {
    const options = availableStatuses.map((status) => ({
      label: translate(status),
      value: status,
    })) as { label: string; value: AssetStatus }[];
    const selected =
      options.find((option) => option.value === status) || options[0];
    return { options, selected };
  }, [status, availableStatuses]);

  return (
    <PropertyRow pair={[label, value]} y={position} even={position % 2 === 0}>
      <Selector options={options} selected={selected} onChange={onChange} />
    </PropertyRow>
  );
};

const StatusRowDeprecated = ({
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
    <PropertyRowReadonly
      pair={[label, value]}
      y={position}
      even={position % 2 === 0}
    />
  );
};

const QuantityRow = ({
  name,
  value,
  unit,
  decimals,
  position,
  onChange,
}: {
  name: string;
  value: number | null;
  unit: Unit;
  position: number;
  decimals?: number;
  onChange?: (name: string, newValue: number) => void;
}) => {
  if (!isFeatureOn("FLAG_EDIT_PROPS"))
    return (
      <QuantityRowDeprecated
        name={name}
        value={value}
        unit={unit}
        position={position}
        decimals={decimals}
      />
    );

  const displayValue =
    value === null
      ? translate("notAvailable")
      : localizeDecimal(value, decimals);

  const label = unit
    ? `${translate(name)} (${translateUnit(unit)})`
    : `${translate(name)}`;

  const handleChange = (value: number) => {
    onChange && onChange(name, value);
  };

  return (
    <PropertyRow
      pair={[label, displayValue]}
      y={position}
      even={position % 2 === 0}
    >
      <NumericField
        label={label}
        displayValue={displayValue}
        onChangeValue={handleChange}
      />
    </PropertyRow>
  );
};

const QuantityRowDeprecated = ({
  name,
  value,
  unit,
  decimals,
  position,
}: {
  name: string;
  value: number | null;
  unit: Unit;
  position: number;
  decimals?: number;
}) => {
  const displayValue =
    value === null
      ? translate("notAvailable")
      : localizeDecimal(value, decimals);

  const label = unit
    ? `${translate(name)} (${translateUnit(unit)})`
    : `${translate(name)}`;
  return (
    <PropertyRowReadonly
      pair={[label, displayValue]}
      y={position}
      even={position % 2 === 0}
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
