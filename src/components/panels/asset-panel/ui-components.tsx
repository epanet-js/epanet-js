import { useRef, useState, KeyboardEventHandler, useCallback } from "react";
import type { PropertyComparison } from "src/hooks/use-asset-comparison";
import { EditableTextField } from "src/components/form/editable-text-field";
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
import {
  DemandPatterns,
  calculateAverageDemand,
} from "src/hydraulic-model/demands";
import { useSetAtom, useAtom } from "jotai";
import { ephemeralStateAtom } from "src/state/jotai";
import { assetPanelFooterAtom } from "src/state/quick-graph";
import { MultipleValuesIcon } from "src/icons";
import { useVirtualizer } from "@tanstack/react-virtual";

export const AssetEditorContent = ({
  label,
  type,
  isNew,
  onLabelChange,
  footer,
  children,
  readOnly = false,
}: {
  label: string;
  type: string;
  isNew?: boolean;
  onLabelChange: (newLabel: string) => string | undefined;
  footer?: React.ReactNode;
  children: React.ReactNode;
  readOnly?: boolean;
}) => {
  const [footerState, setFooterState] = useAtom(assetPanelFooterAtom);

  const handleFooterHeightChange = useCallback(
    (height: number) => {
      setFooterState((prev) => ({ ...prev, height }));
    },
    [setFooterState],
  );

  return (
    <SectionList
      header={
        <Header
          label={label}
          type={type}
          isNew={isNew}
          onLabelChange={onLabelChange}
          readOnly={readOnly}
        />
      }
      footer={footer}
      isStickyFooter={footerState.isPinned}
      stickyFooterHeight={footerState.height}
      onStickyFooterHeightChange={handleFooterHeightChange}
      gap={3}
    >
      {children}
    </SectionList>
  );
};

const Header = ({
  label,
  type,
  isNew,
  onLabelChange,
  readOnly = false,
}: {
  label: string;
  type: string;
  isNew?: boolean;
  onLabelChange: (newLabel: string) => string | undefined;
  readOnly?: boolean;
}) => {
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (newLabel: string): boolean => {
      const validationError = onLabelChange(newLabel);
      setError(validationError ?? null);
      return !!validationError;
    },
    [onLabelChange],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className="px-3 pt-4 pb-3 relative">
      {isNew && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 rounded-full" />
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <EditableTextField
            label={label}
            value={label}
            onChangeValue={handleChange}
            onReset={clearError}
            onDirty={clearError}
            hasError={!!error}
            readOnly={readOnly}
            allowedChars={/(?![\s;])[\x00-\xFF]/}
            maxByteLength={31}
            styleOptions={{
              padding: "sm",
              ghostBorder: true,
              fontWeight: "semibold",
              textSize: "sm",
            }}
          />
        </div>
        <PanelActions />
      </div>
      {error && (
        <span className="text-xs text-orange-600 dark:text-orange-400 block mt-1 pl-1">
          {error}
        </span>
      )}
      <span className="text-sm text-gray-500 pl-1">{type}</span>
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

export const TextRow = ({
  name,
  value,
  comparison,
}: {
  name: string;
  value: string;
  comparison?: PropertyComparison;
}) => {
  const translate = useTranslate();
  const label = translate(name);

  const baseDisplayValue =
    comparison?.hasChanged && comparison.baseValue != null
      ? String(comparison.baseValue)
      : undefined;

  return (
    <InlineField
      name={label}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
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
  comparison,
  onChange,
}: {
  name: string;
  value: number | null;
  unit: Unit;
  positiveOnly?: boolean;
  isNullable?: boolean;
  readOnly?: boolean;
  decimals?: number;
  comparison?: PropertyComparison;
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

  const baseDisplayValue =
    comparison?.hasChanged && comparison.baseValue != null
      ? localizeDecimal(comparison.baseValue as number, { decimals })
      : undefined;

  const handleChange = (newValue: number) => {
    lastChange.current = Date.now();
    onChange && onChange(name, newValue, value);
  };

  return (
    <InlineField
      name={label}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
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
    | PumpStatus
    | number,
>({
  name,
  label,
  selected,
  options,
  comparison,
  readOnly = false,
  onChange,
}: {
  name: string;
  label?: string;
  selected: T;
  options: { label: string; description?: string; value: T }[];
  comparison?: PropertyComparison;
  readOnly?: boolean;
  onChange?: (name: string, newValue: T, oldValue: T) => void;
}) => {
  const translate = useTranslate();
  const actualLabel = label || translate(name);

  const baseDisplayValue =
    comparison?.hasChanged && comparison.baseValue != null
      ? (options.find((o) => o.value === comparison.baseValue)?.label ??
        String(comparison.baseValue))
      : undefined;

  const selectedOption = options.find((o) => o.value === selected);

  return (
    <InlineField
      name={actualLabel}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      {readOnly ? (
        <TextField padding="md">{selectedOption?.label ?? ""}</TextField>
      ) : (
        <div className="w-full">
          <Selector
            ariaLabel={actualLabel}
            options={options}
            selected={selected}
            onChange={(newValue, oldValue) =>
              onChange?.(name, newValue, oldValue)
            }
            disableFocusOnClose={true}
            styleOptions={{
              border: true,
              textSize: "text-sm",
              paddingY: 2,
            }}
          />
        </div>
      )}
    </InlineField>
  );
};

export const SwitchRow = ({
  name,
  label,
  enabled,
  comparison,
  readOnly = false,
  onChange,
}: {
  name: string;
  label?: string;
  enabled: boolean;
  comparison?: PropertyComparison;
  readOnly?: boolean;
  onChange?: (property: string, newValue: boolean, oldValue: boolean) => void;
}) => {
  const translate = useTranslate();
  const actualLabel = label || translate(name);

  const baseDisplayValue =
    comparison?.hasChanged && comparison.baseValue != null
      ? comparison.baseValue
        ? translate("enabled")
        : translate("disabled")
      : undefined;

  const handleToggle = (checked: boolean) => {
    onChange?.(name, checked, enabled);
  };

  return (
    <InlineField
      name={actualLabel}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      <div className="p-2 flex items-center h-[38px]">
        <Checkbox
          checked={enabled}
          aria-label={actualLabel}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={readOnly || !onChange}
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
  patterns,
}: {
  customerCount: number;
  customerPoints: CustomerPoint[];
  aggregateUnit: Unit;
  customerUnit: Unit;
  patterns: DemandPatterns;
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
              patterns={patterns}
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
  patterns,
  onClose,
}: {
  customerPoints: CustomerPoint[];
  aggregateUnit: Unit;
  customerUnit: Unit;
  patterns: DemandPatterns;
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
            const demand = calculateAverageDemand(
              customerPoint.demands,
              patterns,
            );

            const demandValue = localizeDecimal(
              convertTo({ value: demand, unit: aggregateUnit }, customerUnit),
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
