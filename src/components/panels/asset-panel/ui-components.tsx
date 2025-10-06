import { useRef } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { Unit } from "src/quantity";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { Selector } from "src/components/form/selector";
import { NumericField } from "src/components/form/numeric-field";
import { Checkbox } from "src/components/form/Checkbox";
import { PipeStatus } from "src/hydraulic-model/asset-types/pipe";
import {
  PumpDefintionType,
  PumpStatus,
} from "src/hydraulic-model/asset-types/pump";
import { ValveKind, ValveStatus } from "src/hydraulic-model/asset-types/valve";
import { PanelActions } from "./actions";

export const AssetEditorContent = ({
  label,
  type,
  children,
}: {
  label: string;
  type: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{label}</span>
          <PanelActions />
        </div>
        <span className="text-sm text-gray-500">{type}</span>
      </div>
      {children}
    </div>
  );
};

export const AttributesSection = ({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-semibold pb-2">{name}</span>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
};

export const AttributeRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex items-center gap-1">
      <span
        aria-label={`key: ${label}`}
        className="text-sm text-gray-500 w-[120px] flex-shrink-0"
      >
        {label}
      </span>
      {children}
    </div>
  );
};

export const TextField = ({ children }: { children: React.ReactNode }) => (
  <span className="w-full p-2 text-sm text-gray-700">{children}</span>
);

export const TextRow = ({ name, value }: { name: string; value: string }) => {
  const translate = useTranslate();
  const label = translate(name);
  return (
    <AttributeRow label={label}>
      <TextField>{value}</TextField>
    </AttributeRow>
  );
};

export const QuantityRow = ({
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
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
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
    <AttributeRow label={label}>
      {readOnly ? (
        <TextField>{displayValue}</TextField>
      ) : (
        <NumericField
          key={lastChange.current + displayValue}
          label={label}
          positiveOnly={positiveOnly}
          isNullable={isNullable}
          readOnly={readOnly}
          displayValue={displayValue}
          onChangeValue={handleChange}
          styleOptions={{
            padding: "md",
            ghostBorder: readOnly,
            textSize: "sm",
          }}
        />
      )}
    </AttributeRow>
  );
};

export const SelectRow = <
  T extends
    | PipeStatus
    | ValveKind
    | ValveStatus
    | PumpDefintionType
    | PumpStatus,
>({
  name,
  label,
  selected,
  options,
  onChange,
}: {
  name: string;
  label?: string;
  selected: T;
  options: { label: string; description?: string; value: T }[];
  onChange: (name: string, newValue: T, oldValue: T) => void;
}) => {
  const translate = useTranslate();
  const actualLabel = label || translate(name);
  return (
    <AttributeRow label={actualLabel}>
      <div className="w-full">
        <Selector
          ariaLabel={actualLabel}
          options={options}
          selected={selected}
          onChange={(newValue, oldValue) => onChange(name, newValue, oldValue)}
          disableFocusOnClose={true}
          styleOptions={{
            border: true,
            textSize: "text-sm",
            paddingY: 2,
          }}
        />
      </div>
    </AttributeRow>
  );
};

export const SwitchRow = ({
  name,
  label,
  enabled,
  onChange,
}: {
  name: string;
  label?: string;
  enabled: boolean;
  onChange: (property: string, newValue: boolean, oldValue: boolean) => void;
}) => {
  const translate = useTranslate();
  const actualLabel = label || translate(name);

  const handleToggle = (checked: boolean) => {
    onChange(name, checked, enabled);
  };

  return (
    <AttributeRow label={actualLabel}>
      <div className="p-2 flex items-center h-[38px]">
        <Checkbox
          checked={enabled}
          aria-label={actualLabel}
          onChange={(e) => handleToggle(e.target.checked)}
        />
      </div>
    </AttributeRow>
  );
};
