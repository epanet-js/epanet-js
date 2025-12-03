import { useRef, useState, KeyboardEventHandler } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { Unit, convertTo } from "src/quantity";
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
import { useSetAtom } from "jotai";
import { ephemeralStateAtom } from "src/state/jotai";
import { MultipleValuesIcon } from "src/icons";
import { useVirtualizer } from "@tanstack/react-virtual";

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
    <SectionList header={<Header label={label} type={type} />} gap={3}>
      {children}
    </SectionList>
  );
};

const Header = ({ label, type }: { label: string; type: string }) => {
  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold truncate max-w-full" title={label}>
          {label}
        </span>
        <PanelActions />
      </div>
      <span className="text-sm text-gray-500">{type}</span>
    </div>
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
    className={clsx(
      "block w-full text-sm text-gray-700 border border-transparent tabular-nums",
      {
        "p-1": padding === "sm",
        "p-2": padding === "md",
      },
    )}
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
  onChange?: (property: string, newValue: boolean, oldValue: boolean) => void;
}) => {
  const translate = useTranslate();
  const actualLabel = label || translate(name);

  const handleToggle = (checked: boolean) => {
    onChange?.(name, checked, enabled);
  };

  return (
    <InlineField name={actualLabel} labelSize="md">
      <div className="p-2 flex items-center h-[38px]">
        <Checkbox
          checked={enabled}
          aria-label={actualLabel}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={!onChange}
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
          className="text-left text-sm p-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-sm hover:bg-gray-200 focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-purple-500 aria-expanded:ring-1 aria-expanded:ring-purple-500 w-full flex items-center gap-x-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600 tabular-nums"
        >
          <MultipleValuesIcon />
          {customerCount}
        </P.Trigger>
        <P.Portal>
          <StyledPopoverContent align="end">
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

const itemSize = 32;

const CustomerPointsPopover = ({
  customerPoints,
  aggregateUnit,
  customerUnit,
  onClose,
}: {
  customerPoints: CustomerPoint[];
  aggregateUnit: Unit;
  customerUnit: Unit;
  onClose: () => void;
}) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const setEphemeralState = useSetAtom(ephemeralStateAtom);

  const handleCustomerPointHover = (customerPoint: CustomerPoint) => {
    setEphemeralState({
      type: "customerPointsHighlight",
      customerPoints: [customerPoint],
    });
  };

  const handleCustomerPointLeave = () => {
    setEphemeralState({
      type: "customerPointsHighlight",
      customerPoints: customerPoints,
    });
  };

  const rowVirtualizer = useVirtualizer({
    count: customerPoints.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemSize,
    overscan: 5,
  });

  const handleContentKeyDown: KeyboardEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (event.code === "Escape" || event.code === "Enter") {
      event.stopPropagation();
      setEphemeralState({ type: "none" });
      onClose();
    }
  };

  const handleListKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.code !== "ArrowDown" && event.code !== "ArrowUp") return;

    event.stopPropagation();
    rowVirtualizer.scrollBy(event.code === "ArrowDown" ? itemSize : -itemSize);
    parentRef.current && parentRef.current.focus();
  };

  return (
    <div onKeyDown={handleContentKeyDown}>
      <div className="font-sans text-gray-500 dark:text-gray-100 text-xs text-left py-2 flex font-bold border-b border-gray-200 dark:border-gray-700 rounded-t">
        <div className="flex-auto px-2">{translate("customer")}</div>
        <div className="px-2">
          {translate("demand")} ({translateUnit(customerUnit)})
        </div>
      </div>
      <div
        ref={parentRef}
        onKeyDown={handleListKeyDown}
        className="max-h-32 overflow-y-auto"
        tabIndex={0}
      >
        <div
          className="w-full relative rounded"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const customerPoint = customerPoints[virtualRow.index];
            const demandValue = localizeDecimal(
              convertTo(
                { value: customerPoint.baseDemand, unit: aggregateUnit },
                customerUnit,
              ),
            );
            const displayValue = customerPoint.label;

            return (
              <div
                key={virtualRow.index}
                role="listitem"
                aria-label={`Customer point ${displayValue}: ${demandValue}`}
                className="top-0 left-0 block w-full absolute py-2 px-2 flex items-center
                hover:bg-gray-200 dark:hover:bg-gray-700
                gap-x-2 even:bg-gray-100 dark:even:bg-gray-800"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onMouseEnter={() => handleCustomerPointHover(customerPoint)}
                onMouseLeave={handleCustomerPointLeave}
              >
                <div
                  title={displayValue}
                  className="flex-auto font-mono text-xs truncate"
                >
                  {displayValue}
                </div>
                <div
                  className="text-xs font-mono text-gray-600 dark:text-gray-300"
                  title={`${translate("demand")}: ${demandValue}`}
                >
                  {demandValue}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
