import type { IWrappedFeature } from "src/types";
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
import {
  Asset,
  AssetStatus,
  Junction,
  NodeAsset,
  Pipe,
  getNode,
} from "src/hydraulic-model";
import { PanelDetails } from "src/components/panel_details";
import {
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
import { Reservoir } from "src/hydraulic-model/asset-types/reservoir";
import {
  HeadlossFormula,
  PipeStatus,
  pipeStatuses,
} from "src/hydraulic-model/asset-types/pipe";
import {
  changePipeStatus,
  changeProperty,
} from "src/hydraulic-model/model-operations";
import { useAtomValue } from "jotai";
import { dataAtom } from "src/state/jotai";
import { usePersistence } from "src/lib/persistence/context";
import * as E from "src/components/elements";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { Selector } from "../form/Selector";
import { useUserTracking } from "src/infra/user-tracking";

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
        <AssetEditorInner
          asset={selectedFeature as Asset}
          quantitiesMetadata={quantitiesMetadata}
        />
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
  const userTracking = useUserTracking();

  const handlePropertyChange = (
    name: string,
    value: number,
    oldValue: number | null,
  ) => {
    const moment = changeProperty(hydraulicModel, {
      assetIds: [asset.id],
      property: name,
      value,
    });
    transact(moment);
    userTracking.capture({
      name: "assetProperty.edited",
      type: asset.type,
      property: name,
      newValue: value,
      oldValue,
    });
  };

  const handleStatusChange = useCallback(
    (newStatus: PipeStatus, oldStatus: PipeStatus) => {
      const moment = changePipeStatus(hydraulicModel, {
        pipeId: asset.id,
        newStatus,
      });
      transact(moment);
      userTracking.capture({
        name: "assetStatus.edited",
        type: asset.type,
        property: "status",
        newValue: newStatus,
        oldValue: oldStatus,
      });
    },
    [hydraulicModel, asset.id, asset.type, transact, userTracking],
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
      const pipe = asset as Pipe;
      const [startNodeId, endNodeId] = pipe.connections;
      const startNode = getNode(hydraulicModel.assets, startNodeId);
      const endNode = getNode(hydraulicModel.assets, endNodeId);

      return (
        <PipeEditor
          pipe={pipe}
          startNode={startNode}
          endNode={endNode}
          headlossFormula={hydraulicModel.headlossFormula}
          quantitiesMetadata={quantitiesMetadata}
          onPropertyChange={handlePropertyChange}
          onStatusChange={handleStatusChange}
        />
      );
    case "pump":
      return <>PUMP</>;
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

type OnPropertyChange = (
  name: string,
  value: number,
  oldValue: number | null,
) => void;
type OnStatusChange = (newStatus: PipeStatus, oldStatus: PipeStatus) => void;

const PipeEditor = ({
  pipe,
  startNode,
  endNode,
  headlossFormula,
  quantitiesMetadata,
  onPropertyChange,
  onStatusChange,
}: {
  pipe: Pipe;
  startNode: NodeAsset | null;
  endNode: NodeAsset | null;
  headlossFormula: HeadlossFormula;
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
              <TextRowReadOnly name="label" value={pipe.label} />
              <TextRowReadOnly
                name="startNode"
                value={startNode ? startNode.label : ""}
              />
              <TextRowReadOnly
                name="endNode"
                value={endNode ? endNode.label : ""}
              />
              <StatusRow
                name={"status"}
                status={pipe.status}
                availableStatuses={pipeStatuses}
                onChange={onStatusChange}
              />
              <QuantityRow
                name="diameter"
                value={pipe.diameter}
                positiveOnly={true}
                isNullable={false}
                unit={quantitiesMetadata.getUnit("diameter")}
                decimals={quantitiesMetadata.getDecimals("diameter")}
                onChange={onPropertyChange}
              />
              <QuantityRow
                name="length"
                value={pipe.length}
                positiveOnly={true}
                isNullable={false}
                unit={quantitiesMetadata.getUnit("length")}
                decimals={quantitiesMetadata.getDecimals("length")}
                onChange={onPropertyChange}
              />
              <QuantityRow
                name="roughness"
                value={pipe.roughness}
                positiveOnly={true}
                unit={quantitiesMetadata.getUnit("roughness")}
                decimals={quantitiesMetadata.getDecimals("roughness")}
                onChange={onPropertyChange}
              />
              <QuantityRow
                name="minorLoss"
                value={pipe.minorLoss}
                positiveOnly={true}
                unit={quantitiesMetadata.getMinorLossUnit(headlossFormula)}
                decimals={quantitiesMetadata.getDecimals("minorLoss")}
                onChange={onPropertyChange}
              />
              <QuantityRow
                name="flow"
                value={pipe.flow}
                unit={quantitiesMetadata.getUnit("flow")}
                decimals={quantitiesMetadata.getDecimals("flow")}
                readOnly={true}
              />
              <QuantityRow
                name="velocity"
                value={pipe.velocity}
                unit={quantitiesMetadata.getUnit("velocity")}
                decimals={quantitiesMetadata.getDecimals("velocity")}
                readOnly={true}
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
              <TextRowReadOnly name="label" value={junction.label} />
              <QuantityRow
                name="elevation"
                value={junction.elevation}
                unit={quantitiesMetadata.getUnit("elevation")}
                decimals={quantitiesMetadata.getDecimals("elevation")}
                onChange={onPropertyChange}
              />
              <QuantityRow
                name="demand"
                value={junction.demand}
                unit={quantitiesMetadata.getUnit("demand")}
                decimals={quantitiesMetadata.getDecimals("demand")}
                onChange={onPropertyChange}
              />
              <QuantityRow
                name="pressure"
                value={junction.pressure}
                unit={quantitiesMetadata.getUnit("pressure")}
                decimals={quantitiesMetadata.getDecimals("pressure")}
                readOnly={true}
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
              <TextRowReadOnly name="label" value={reservoir.label} />
              <QuantityRow
                name="elevation"
                value={reservoir.elevation}
                unit={quantitiesMetadata.getUnit("elevation")}
                decimals={quantitiesMetadata.getDecimals("elevation")}
                onChange={onPropertyChange}
              />
              <QuantityRow
                name="head"
                value={reservoir.head}
                unit={quantitiesMetadata.getUnit("head")}
                decimals={quantitiesMetadata.getDecimals("head")}
                onChange={onPropertyChange}
              />
            </tbody>
          </table>
        </div>
      </div>
    </PanelDetails>
  );
};

const TextRowReadOnly = ({ name, value }: { name: string; value: string }) => {
  const label = translate(name);
  return <PropertyRowReadonly pair={[label, value]} />;
};

const StatusRow = ({
  name,
  status,
  availableStatuses,
  onChange,
}: {
  name: string;
  status: AssetStatus;
  availableStatuses: readonly AssetStatus[];
  onChange: (newStatus: AssetStatus, oldStateu: AssetStatus) => void;
}) => {
  const label = translate(name);

  const options = useMemo(() => {
    const options = availableStatuses.map((status) => ({
      label: translate(status),
      value: status,
    })) as { label: string; value: AssetStatus }[];
    return options;
  }, [availableStatuses]);

  return (
    <PropertyRow label={label}>
      <div className="relative group-1">
        <Selector
          ariaLabel={"Value for: Status"}
          options={options}
          selected={status}
          onChange={onChange}
          styleOptions={{ border: false, textSize: "text-xs" }}
        />
      </div>
    </PropertyRow>
  );
};

const QuantityRow = ({
  name,
  value,
  unit,
  decimals,
  positiveOnly = false,
  readOnly = false,
  isNullable = true,
  onChange,
}: {
  name: string;
  value: number | null;
  unit: Unit;
  positiveOnly?: boolean;
  isNullable?: boolean;
  readOnly?: boolean;
  decimals?: number;
  onChange?: (name: string, newValue: number, oldValue: number | null) => void;
}) => {
  const lastChange = useRef<number>(0);

  const displayValue =
    value === null
      ? translate("notAvailable")
      : localizeDecimal(value, { decimals });

  const label = unit
    ? `${translate(name)} (${translateUnit(unit)})`
    : `${translate(name)}`;

  const handleChange = (newValue: number) => {
    lastChange.current = Date.now();
    onChange && onChange(name, newValue, value);
  };

  return (
    <PropertyRow label={label}>
      <NumericField
        key={lastChange.current + (value === null ? "NULL" : displayValue)}
        label={label}
        positiveOnly={positiveOnly}
        isNullable={isNullable}
        readOnly={readOnly}
        displayValue={displayValue}
        onChangeValue={handleChange}
      />
    </PropertyRow>
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

export const NumericField = ({
  label,
  displayValue,
  onChangeValue,
  positiveOnly = false,
  readOnly = false,
  isNullable = true,
}: {
  label: string;
  displayValue: string;
  onChangeValue?: (newValue: number) => void;
  isNullable?: boolean;
  positiveOnly?: boolean;
  readOnly?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(displayValue);
  const [hasError, setError] = useState(false);
  const [isDirty, setDirty] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Escape") {
      resetInput();
      return;
    }
    if (e.key === "Enter" && !hasError) {
      handleCommitLastChange();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "y")) {
      e.preventDefault();
    }
  };

  const resetInput = () => {
    setInputValue(displayValue);
    setDirty(false);
    setError(false);
    blurInput();
  };

  const handleBlur = () => {
    if (isDirty && !hasError) {
      handleCommitLastChange();
    } else {
      resetInput();
    }
  };

  const handleFocus: FocusEventHandler<HTMLInputElement> = (e) => {
    e.preventDefault();
    setInputValue(reformatWithoutGroups(displayValue));
    setTimeout(() => inputRef.current && inputRef.current.select(), 0);
  };

  const handleCommitLastChange = () => {
    const numericValue = parseLocaleNumber(inputValue);
    setInputValue(String(numericValue));
    onChangeValue && onChangeValue(numericValue);

    setDirty(false);
    setError(false);
    blurInput();
  };

  const blurInput = () => {
    if (inputRef.current !== document.activeElement) return;

    setTimeout(() => inputRef.current && inputRef.current.blur(), 0);
  };

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    let newInputValue = e.target.value;
    newInputValue = newInputValue.replace(/[^0-9\-eE.,]/g, "");

    if (positiveOnly) {
      newInputValue = newInputValue.replace(/^-/g, "");
    }
    setInputValue(newInputValue);
    const numericValue = parseLocaleNumber(newInputValue);
    setError(isNaN(numericValue) || (!isNullable && numericValue === 0));
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
