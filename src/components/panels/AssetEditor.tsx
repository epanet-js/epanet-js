import type { IWrappedFeature } from "src/types";
import { FeatureEditorProperties } from "./feature_editor/feature_editor_properties";
import { FeatureEditorId } from "./feature_editor/feature_editor_id";
import React, {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { RawEditor } from "./feature_editor/raw_editor";
import { Asset, AssetStatus, Junction, Pipe } from "src/hydraulic-model";
import { PanelDetails } from "src/components/panel_details";
import {
  localizeDecimal,
  parseLocaleNumber,
  reformatWithoutGroups,
  translate,
  translateUnit,
} from "src/infra/i18n";
import {
  PropertyRow,
  PropertyRowReadonly,
} from "./feature_editor/property_row";
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
import * as E from "src/components/elements";
import * as Select from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";

export function AssetEditor({
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
          <AssetEditorInner
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

const AssetEditorInner = ({
  asset,
  quantitiesMetadata,
}: {
  asset: Asset;
  quantitiesMetadata: Quantities;
}) => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();

  const handlePropertyChange = (name: string, value: number) => {
    const moment = changeProperty(hydraulicModel, {
      assetIds: [asset.id],
      property: name,
      value,
    });
    transact(moment);
  };

  const handleStatusChange = useCallback(
    (newStatus: PipeStatus) => {
      const moment = changePipeStatus(hydraulicModel, {
        pipeId: asset.id,
        newStatus,
      });
      transact(moment);
    },
    [hydraulicModel, asset.id, transact],
  );

  switch (asset.type) {
    case "junction":
      return (
        <JunctionEditor
          junction={asset as Junction}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
        />
      );
    case "pipe":
      return (
        <PipeEditor
          pipe={asset as Pipe}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
          onStatusChange={handleStatusChange}
        />
      );
    case "reservoir":
      return (
        <ReservoirEditor
          reservoir={asset as Reservoir}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
        />
      );
  }
};

type OnPropertyChange = (name: string, value: number) => void;
type OnStatusChange = (newStatus: PipeStatus) => void;

const PipeEditor = ({
  pipe,
  quantitiesMetadata,
  onPropertyChange,
  onStatusChange,
}: {
  pipe: Pipe;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
  onStatusChange: OnStatusChange;
}) => {
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
                  onChange={onStatusChange}
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
                onChange={onPropertyChange}
              />
              <QuantityRow
                name="length"
                position={2}
                value={pipe.length}
                unit={quantitiesMetadata.getUnit("pipe", "length")}
                decimals={quantitiesMetadata.getDecimals("pipe", "length")}
                onChange={onPropertyChange}
              />
              <QuantityRow
                name="roughness"
                position={3}
                value={pipe.roughness}
                unit={quantitiesMetadata.getUnit("pipe", "roughness")}
                decimals={quantitiesMetadata.getDecimals("pipe", "roughness")}
                onChange={onPropertyChange}
              />
              <QuantityRow
                name="minorLoss"
                position={4}
                value={pipe.minorLoss}
                unit={quantitiesMetadata.getUnit("pipe", "minorLoss")}
                decimals={quantitiesMetadata.getDecimals("pipe", "minorLoss")}
                onChange={onPropertyChange}
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
  onPropertyChange,
}: {
  junction: Junction;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
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
                unit={quantitiesMetadata.getUnit("junction", "elevation")}
                decimals={quantitiesMetadata.getDecimals(
                  "junction",
                  "elevation",
                )}
                onChange={onPropertyChange}
              />
              <QuantityRow
                name="demand"
                position={1}
                value={junction.demand}
                unit={quantitiesMetadata.getUnit("junction", "demand")}
                decimals={quantitiesMetadata.getDecimals("junction", "demand")}
                onChange={onPropertyChange}
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
  onPropertyChange,
}: {
  reservoir: Reservoir;
  quantitiesMetadata: Quantities;
  onPropertyChange: OnPropertyChange;
}) => {
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
                onChange={onPropertyChange}
              />
              <QuantityRow
                name="head"
                position={1}
                value={reservoir.head}
                unit={quantitiesMetadata.getUnit("reservoir", "head")}
                decimals={quantitiesMetadata.getDecimals("reservoir", "head")}
                onChange={onPropertyChange}
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
    <PropertyRow label={label} y={position} even={position % 2 === 0}>
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
  const lastChange = useRef<number>(0);

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
    lastChange.current = Date.now();
    onChange && onChange(name, value);
  };

  return (
    <PropertyRow label={label} y={position} even={position % 2 === 0}>
      <NumericField
        key={lastChange.current}
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

const NumericField = ({
  label,
  displayValue,
  onChangeValue,
  readOnly = false,
}: {
  label: string;
  displayValue: string;
  onChangeValue: (newValue: number) => void;
  readOnly?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(displayValue);
  const [hasError, setError] = useState(false);
  const [isDirty, setDirty] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      handleCommitLastChange();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "y")) {
      e.preventDefault();
    }
  };

  const handleBlur = () => {
    if (isDirty) {
      handleCommitLastChange();
    } else {
      setInputValue(displayValue);
    }
  };

  const handleFocus: FocusEventHandler<HTMLInputElement> = (e) => {
    e.preventDefault();
    setInputValue(reformatWithoutGroups(displayValue));
    setTimeout(() => inputRef.current && inputRef.current.select(), 0);
  };

  const handleCommitLastChange = () => {
    const numericValue = parseLocaleNumber(inputValue);
    if (isNaN(numericValue)) {
      setInputValue(displayValue);
    } else {
      setInputValue(String(numericValue));
      onChangeValue(numericValue);
    }

    setDirty(false);
    setError(false);
    setTimeout(() => inputRef.current && inputRef.current.blur(), 0);
  };

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const newInputValue = e.target.value;
    setInputValue(newInputValue);
    const numericValue = parseLocaleNumber(newInputValue);
    setError(isNaN(numericValue));
    setDirty(true);
  };

  if (hasError && inputRef.current) {
    inputRef.current.className = E.styledPropertyInputWithError("right");
  }
  if (!hasError && inputRef.current) {
    inputRef.current.className = E.styledPropertyInput("right");
  }

  return (
    <div className="relative group-1">
      <input
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        spellCheck="false"
        type="text"
        className={E.styledPropertyInput("right")}
        aria-label={`Value for: ${label}`}
        readOnly={readOnly}
        onBlur={handleBlur}
        ref={inputRef}
        value={inputValue}
        onFocus={handleFocus}
        tabIndex={1}
      />
    </div>
  );
};

const Selector = <T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { label: string; value: T }[];
  selected: { label: string; value: T };
  onChange: (selected: T) => void;
}) => {
  const [isOpen, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.code === "Escape" || event.code === "Enter") {
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative group-1">
      <Select.Root
        value={selected.value}
        open={isOpen}
        onOpenChange={handleOpenChange}
        onValueChange={onChange}
      >
        <Select.Trigger
          aria-label={`Value for: Status`}
          tabIndex={1}
          className="flex items-center text-xs text-gray-700 dark:items-center justify-between w-full min-w-[90px] pr-1 pl-2 pl-min-2 py-2 focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10"
        >
          <Select.Value />
          <Select.Icon className="px-1">
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            onKeyDown={handleKeyDown}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="bg-white w-full border text-xs rounded-md shadow-md"
          >
            <Select.Viewport className="p-1">
              {options.map((option, i) => (
                <Select.Item
                  key={i}
                  value={option.value}
                  className="flex items-center px-2 py-2 cursor-pointer focus:bg-purple-300/40"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="ml-auto">
                    <CheckIcon className="text-purple-700" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
};
