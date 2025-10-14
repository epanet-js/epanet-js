import { useRef, useState, KeyboardEventHandler } from "react";
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
import { InlineField, SectionList } from "src/components/form/fields";
import clsx from "clsx";
import * as P from "@radix-ui/react-popover";
import { StyledPopoverArrow, StyledPopoverContent } from "../../elements";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { CustomerPointsPopover } from "../feature-editor/customer-points-popover";
import { useSetAtom } from "jotai";
import { ephemeralStateAtom } from "src/state/jotai";
import { MultipleValuesIcon } from "src/icons";

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
    <SectionList>
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className="font-semibold truncate max-w-full" title={label}>
            {label}
          </span>
          <PanelActions />
        </div>
        <span className="text-sm text-gray-500">{type}</span>
      </div>
      {children}
    </SectionList>
  );
};

export const TextField = ({
  children,
  padding = "md",
}: {
  children: React.ReactNode;
  padding?: "sm" | "md";
}) => (
  <span
    className={clsx("block w-full text-sm text-gray-700", {
      "p-1": padding === "sm",
      "p-2": padding === "md",
    })}
  >
    {children}
  </span>
);

export const TextRow = ({ name, value }: { name: string; value: string }) => {
  const translate = useTranslate();
  const label = translate(name);
  return (
    <InlineField name={label} labelSize="md">
      <TextField>{value}</TextField>
    </InlineField>
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
    <InlineField name={label} labelSize="md">
      {readOnly ? (
        <TextField padding="md">{displayValue}</TextField>
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
    </InlineField>
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
    <InlineField name={actualLabel} labelSize="md">
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
    </InlineField>
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
    <InlineField name={actualLabel} labelSize="md">
      <div className="p-2 flex items-center h-[38px]">
        <Checkbox
          checked={enabled}
          aria-label={actualLabel}
          onChange={(e) => handleToggle(e.target.checked)}
        />
      </div>
    </InlineField>
  );
};

export const ConnectedCustomersRow = ({
  customerCount,
  customerPoints,
  aggregateUnit,
  customerUnit,
}: {
  customerCount: number;
  customerPoints: CustomerPoint[];
  aggregateUnit: Unit;
  customerUnit: Unit;
}) => {
  const translate = useTranslate();
  const [isOpen, setIsOpen] = useState(false);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);

  const handleClose = () => {
    setEphemeralState({ type: "none" });
    setIsOpen(false);
  };

  const handleTriggerKeyDown: KeyboardEventHandler<HTMLButtonElement> = (
    event,
  ) => {
    if (event.code === "Enter" && !isOpen) {
      setIsOpen(true);
      event.stopPropagation();
    }
  };

  return (
    <InlineField name={translate("connectedCustomers")} labelSize="md">
      <P.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleClose();
          } else {
            setIsOpen(true);
            setEphemeralState({
              type: "customerPointsHighlight",
              customerPoints: customerPoints,
            });
          }
        }}
      >
        <P.Trigger
          aria-label={`Connected customers: ${customerCount}`}
          onKeyDown={handleTriggerKeyDown}
          className="text-left text-sm p-2 text-gray-700 border border-gray-300 focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-purple-500 aria-expanded:ring-1 aria-expanded:ring-purple-500 w-full bg-transparent flex items-center gap-x-1"
        >
          <MultipleValuesIcon />
          {customerCount}
        </P.Trigger>
        <P.Portal>
          <StyledPopoverContent>
            <StyledPopoverArrow />
            <CustomerPointsPopover
              customerPoints={customerPoints}
              aggregateUnit={aggregateUnit}
              customerUnit={customerUnit}
              onClose={handleClose}
            />
          </StyledPopoverContent>
        </P.Portal>
      </P.Root>
    </InlineField>
  );
};
