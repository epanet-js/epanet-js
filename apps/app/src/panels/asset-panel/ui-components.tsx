import {
  useRef,
  useState,
  useMemo,
  useCallback,
  type ComponentProps,
  type KeyboardEventHandler,
} from "react";
import type { PropertyComparison } from "src/hooks/use-asset-comparison";
import { EditableTextField } from "src/components/form/editable-text-field";
import { TextField } from "src/components/form/text-field";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { Unit, convertTo } from "@epanet-js/quantity";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useValueDisplay } from "src/hooks/use-value-display";
import type { QuantityProperty } from "src/lib/project-settings/quantities-spec";
import { SelectorListOption } from "src/components/form/selector-list";
import { Selector } from "src/components/form/selector";
import { NumericField } from "src/components/form/numeric-field";
import { Checkbox } from "src/components/form/Checkbox";
import {
  PipeStatus,
  PumpDefinitionType,
  PumpStatus,
  ValveKind,
  ValveStatus,
  type TankMixingModel,
  type ChemicalSourceType,
  CustomerPoint,
  LabelManager,
  type LabelType,
} from "@epanet-js/hydraulic-model";
import { PanelActions } from "./actions";
import {
  InlineField,
  SectionList,
  CollapsibleSection,
} from "src/components/form/fields";
import {
  assetPanelSectionsExpandedAtom,
  type AssetPanelSectionExpanded,
} from "src/state/layout";
import clsx from "clsx";
import * as P from "@radix-ui/react-popover";
import {
  StyledPopoverArrow,
  StyledPopoverContent,
} from "src/components/elements";
import {
  Patterns,
  calculateAverageDemand,
  getCustomerPointDemands,
  Demands,
} from "src/hydraulic-model";
import { useSetAtom, useAtom } from "jotai";
import { ephemeralStateAtom } from "src/state/drawing";
import { assetPanelFooterAtom } from "src/state/quick-graph";
import { MultipleValuesIcon } from "src/icons";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PaywallFeature } from "src/state/dialog";
import {
  PaywallLockButton,
  PaywallOverlay,
  useFeatureLock,
} from "src/components/form/paywall";

export const AssetEditorContent = ({
  label,
  type,
  labelType,
  isNew,
  onLabelChange,
  footer,
  children,
  readOnly = false,
}: {
  label: string;
  type: string;
  labelType: LabelType;
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
          labelType={labelType}
          isNew={isNew}
          onLabelChange={onLabelChange}
          readOnly={readOnly}
        />
      }
      footer={footer}
      isStickyFooter={footerState.isPinned}
      stickyFooterHeight={footerState.height}
      onStickyFooterHeightChange={handleFooterHeightChange}
      padding={3}
      overflow={true}
    >
      {children}
    </SectionList>
  );
};

const Header = ({
  label,
  type,
  labelType,
  isNew,
  onLabelChange,
  readOnly = false,
}: {
  label: string;
  type: string;
  labelType: LabelType;
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
    <div className={clsx("px-3 pt-4 pb-3 relative")}>
      {isNew && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-full" />
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
            sanitize={(raw) => LabelManager.sanitizeLabel(raw, labelType)}
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
        <span className="text-size-small text-warning block mt-1 pl-1">
          {error}
        </span>
      )}
      <span className="text-size-base text-subtle pl-1">{type}</span>
    </div>
  );
};

type PaywalledInlineFieldProps = Omit<
  ComponentProps<typeof InlineField>,
  "labelAction"
> & {
  paywall?: PaywallFeature;
};

const PaywalledInlineField = ({
  paywall,
  children,
  ...inlineFieldProps
}: PaywalledInlineFieldProps) => {
  const { isLocked } = useFeatureLock(paywall);
  const { name } = inlineFieldProps;
  return (
    <InlineField
      {...inlineFieldProps}
      labelAction={
        isLocked ? (
          <PaywallLockButton feature={paywall!} label={name} />
        ) : undefined
      }
    >
      {isLocked ? (
        <PaywallOverlay feature={paywall!} ariaLabel={name}>
          {children}
        </PaywallOverlay>
      ) : (
        children
      )}
    </InlineField>
  );
};

export const TextRow = ({
  name,
  value,
  comparison,
  paywall,
}: {
  name: string;
  value: string;
  comparison?: PropertyComparison;
  paywall?: PaywallFeature;
}) => {
  const translate = useTranslate();
  const label = translate(name);

  const baseDisplayValue =
    comparison?.hasChanged && comparison.baseValue != null
      ? String(comparison.baseValue)
      : undefined;

  return (
    <PaywalledInlineField
      name={label}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
      paywall={paywall}
    >
      <TextField>{value}</TextField>
    </PaywalledInlineField>
  );
};

export const QuantityRow = <P extends string>({
  name,
  value,
  unit,
  positiveOnly = false,
  readOnly = false,
  isNullable = true,
  placeholder = "",
  comparison,
  onChange,
  validate,
  displayName,
  paywall,
}: {
  name: P;
  value: number | null;
  unit: Unit;
  positiveOnly?: boolean;
  isNullable?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  comparison?: PropertyComparison;
  onChange?: (
    name: P,
    newValue: number | null,
    oldValue: number | null,
  ) => void;
  validate?: (value: number) => boolean;
  displayName?: string;
  paywall?: PaywallFeature;
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const lastChange = useRef<number>(0);
  const { displayValue: formatValue } = useValueDisplay();

  const displayValue =
    value === null
      ? isNullable && placeholder
        ? ""
        : translate("notAvailable")
      : formatValue(value, name as QuantityProperty);

  const translatedName = displayName ?? translate(name);
  const label = unit
    ? `${translatedName} (${translateUnit(unit)})`
    : `${translatedName}`;

  const baseDisplayValue =
    comparison?.hasChanged && comparison.baseValue != null
      ? formatValue(comparison.baseValue as number, name as QuantityProperty)
      : undefined;

  const handleChange = (newValue: number, isEmpty: boolean) => {
    lastChange.current = Date.now();
    if (isEmpty) {
      if (isNullable && placeholder) onChange && onChange(name, null, value);
      return;
    }
    onChange && onChange(name, newValue, value);
  };

  return (
    <PaywalledInlineField
      name={label}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
      paywall={paywall}
    >
      {readOnly ? (
        <TextField padding="md">{displayValue}</TextField>
      ) : (
        <NumericField
          key={lastChange.current + displayValue}
          label={label}
          positiveOnly={positiveOnly}
          isNullable={isNullable}
          validate={validate}
          readOnly={readOnly}
          displayValue={displayValue}
          placeholder={placeholder}
          onChangeValue={handleChange}
          styleOptions={{
            padding: "md",
            ghostBorder: readOnly,
            textSize: "sm",
          }}
        />
      )}
    </PaywalledInlineField>
  );
};

export const IntegerRow = <P extends string>({
  name,
  value,
  positiveOnly = false,
  readOnly = false,
  isNullable = true,
  placeholder = "",
  comparison,
  onChange,
  displayName,
  paywall,
  validate,
}: {
  name: P;
  value: number | null;
  positiveOnly?: boolean;
  isNullable?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  comparison?: PropertyComparison;
  onChange?: (
    name: P,
    newValue: number | null,
    oldValue: number | null,
  ) => void;
  displayName?: string;
  paywall?: PaywallFeature;
  validate?: (value: number) => boolean;
}) => {
  const translate = useTranslate();
  const lastChange = useRef<number>(0);

  const displayValue = value === null ? "" : String(value);
  const label = displayName ?? translate(name);

  const baseDisplayValue = comparison?.hasChanged
    ? comparison.baseValue != null
      ? String(comparison.baseValue)
      : translate("none")
    : undefined;

  const handleChange = (newValue: number, isEmpty: boolean) => {
    lastChange.current = Date.now();
    if (isEmpty) {
      if (isNullable) onChange && onChange(name, null, value);
      return;
    }
    if (!Number.isFinite(newValue)) return;
    const truncated = Math.trunc(newValue);
    if (positiveOnly && truncated < 0) return;
    onChange && onChange(name, truncated, value);
  };

  return (
    <PaywalledInlineField
      name={label}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
      paywall={paywall}
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
          placeholder={placeholder}
          onChangeValue={handleChange}
          validate={validate}
          styleOptions={{
            padding: "md",
            ghostBorder: readOnly,
            textSize: "sm",
          }}
        />
      )}
    </PaywalledInlineField>
  );
};

export const CreatableTextRow = <P extends string>({
  name,
  value,
  options,
  readOnly = false,
  placeholder,
  comparison,
  onChange,
  paywall,
  validateNew,
}: {
  name: P;
  value: string | null;
  options: string[];
  readOnly?: boolean;
  placeholder?: string;
  comparison?: PropertyComparison;
  onChange?: (
    name: P,
    newValue: string | null,
    oldValue: string | null,
  ) => void;
  paywall?: PaywallFeature;
  validateNew?: (query: string) => boolean;
}) => {
  const translate = useTranslate();
  const label = translate(name);
  const resolvedPlaceholder = placeholder ?? translate("none");

  const baseDisplayValue = comparison?.hasChanged
    ? comparison.baseValue != null
      ? String(comparison.baseValue)
      : translate("none")
    : undefined;

  const handleChange = useCallback(
    (newValue: string | null) => {
      const normalized = newValue === null ? null : newValue.trim() || null;
      const canonical =
        normalized === null
          ? null
          : (options.find(
              (o) => o.toLowerCase() === normalized.toLowerCase(),
            ) ?? normalized);
      if (canonical === value) return;
      onChange && onChange(name, canonical, value);
    },
    [name, onChange, options, value],
  );

  return (
    <PaywalledInlineField
      name={label}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
      paywall={paywall}
    >
      {readOnly ? (
        <TextField padding="md">{value ?? ""}</TextField>
      ) : (
        <Selector
          options={options.map((o) => ({ value: o, label: o }))}
          selected={value}
          nullable
          allowNew
          onChange={handleChange}
          placeholder={resolvedPlaceholder}
          clearLabel={resolvedPlaceholder}
          ariaLabel={label}
          validateNew={validateNew}
        />
      )}
    </PaywalledInlineField>
  );
};

export type TankDefinitionMode =
  | "diameterBased"
  | "areaBased"
  | "volumeBased"
  | "curveBased";

type SelectRowValue =
  | PipeStatus
  | ValveKind
  | ValveStatus
  | PumpDefinitionType
  | PumpStatus
  | TankDefinitionMode
  | TankMixingModel
  | ChemicalSourceType
  | "none"
  | number;

type LibrarySelectRowProps<P extends string> = {
  name: P;
  collection: Map<number, { id: number; label: string; type?: string }>;
  filterByType: string;
  libraryLabel: string;
  onOpenLibrary: () => void;
  selected: number | null;
  onChange?: (
    name: P,
    newValue: number | null,
    oldValue: number | null,
  ) => void;
  emptyOptionLabel?: string;
  placeholder?: string;
  excludeId?: number;
  readOnly?: boolean;
  comparison?: PropertyComparison;
  paywall?: PaywallFeature;
};

type SelectRowPropsBase<P extends string, T extends SelectRowValue> = {
  name: P;
  label?: string;
  options: SelectorListOption<T>[];
  listClassName?: string;
  actionLabel?: string;
  onActionClick?: () => void;
  comparison?: PropertyComparison;
  readOnly?: boolean;
  paywall?: PaywallFeature;
};

type SelectRowPropsNonNullable<
  P extends string,
  T extends SelectRowValue,
> = SelectRowPropsBase<P, T> & {
  selected: T;
  nullable?: false;
  onChange?: (name: P, newValue: T, oldValue: T) => void;
  placeholder?: undefined;
  clearLabel?: never;
};

type SelectRowPropsNullable<
  P extends string,
  T extends SelectRowValue,
> = SelectRowPropsBase<P, T> & {
  selected: T | null;
  nullable: true;
  placeholder: string;
  clearLabel?: string;
  onChange?: (name: P, newValue: T | null, oldValue: T | null) => void;
};

type SelectorRowProps<P extends string, T extends SelectRowValue> =
  | SelectRowPropsNullable<P, T>
  | SelectRowPropsNonNullable<P, T>;

export function SelectRow<P extends string, T extends SelectRowValue>({
  name,
  label,
  selected,
  options,
  listClassName,
  actionLabel,
  onActionClick,
  comparison,
  readOnly,
  paywall,
  nullable = false,
  placeholder = undefined,
  clearLabel,
  onChange,
}: SelectorRowProps<P, T>) {
  const translate = useTranslate();
  const actualLabel = label || translate(name);

  const baseDisplayValue = comparison?.hasChanged
    ? comparison.baseValue != null
      ? (options.find((o) => o.value === comparison.baseValue)?.label ??
        String(comparison.baseValue))
      : `(${translate("none").toLocaleLowerCase()})`
    : undefined;

  const selectedOption = options.find((o) => o.value === selected);

  return (
    <PaywalledInlineField
      name={actualLabel}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
      paywall={paywall}
    >
      {readOnly ? (
        <TextField padding="md">{selectedOption?.label ?? ""}</TextField>
      ) : (
        <div className="w-full">
          <Selector
            ariaLabel={actualLabel}
            options={options}
            selected={selected}
            nullable={nullable as true}
            onChange={(newValue, oldValue) =>
              onChange?.(name, newValue as T, oldValue as T)
            }
            placeholder={placeholder as string}
            clearLabel={clearLabel}
            listClassName={listClassName}
            actionLabel={actionLabel}
            onActionClick={onActionClick}
            styleOptions={{
              border: true,
              textSize: "text-size-base",
              paddingY: 2,
            }}
          />
        </div>
      )}
    </PaywalledInlineField>
  );
}

const useLibraryItems = (
  collection: LibrarySelectRowProps<string>["collection"],
  filterByType: string,
  excludeId: number | undefined,
) =>
  useMemo(() => {
    const out: SelectorListOption<number>[] = [];
    for (const item of collection.values()) {
      if (item.type !== filterByType) continue;
      if (item.id === excludeId) continue;
      out.push({ value: item.id, label: item.label });
    }
    return out;
  }, [collection, filterByType, excludeId]);

export function LibrarySelectRow<P extends string>({
  name,
  collection,
  filterByType,
  libraryLabel,
  onOpenLibrary,
  selected,
  onChange,
  emptyOptionLabel,
  placeholder,
  excludeId,
  readOnly,
  comparison,
  paywall,
}: LibrarySelectRowProps<P>) {
  const translate = useTranslate();
  const items = useLibraryItems(collection, filterByType, excludeId);

  const resolvedPlaceholder = readOnly
    ? (placeholder ?? emptyOptionLabel ?? "")
    : (placeholder ?? emptyOptionLabel ?? `${translate("select")}...`);

  return (
    <SelectRow
      name={name}
      selected={selected}
      options={items}
      nullable={true}
      placeholder={resolvedPlaceholder}
      clearLabel={emptyOptionLabel}
      actionLabel={libraryLabel}
      onActionClick={onOpenLibrary}
      onChange={onChange}
      readOnly={readOnly}
      comparison={comparison}
      paywall={paywall}
    />
  );
}

export const SwitchRow = <P extends string>({
  name,
  label,
  enabled,
  comparison,
  readOnly = false,
  onChange,
  paywall,
}: {
  name: P;
  label?: string;
  enabled: boolean;
  comparison?: PropertyComparison;
  readOnly?: boolean;
  onChange?: (property: P, newValue: boolean, oldValue: boolean) => void;
  paywall?: PaywallFeature;
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
    <PaywalledInlineField
      name={actualLabel}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
      paywall={paywall}
    >
      <div className="p-2 flex items-center h-[38px]">
        <Checkbox
          checked={enabled}
          aria-label={actualLabel}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={readOnly || !onChange}
        />
      </div>
    </PaywalledInlineField>
  );
};

export const ConnectedCustomersRow = ({
  customerCount,
  customerPoints,
  aggregateUnit,
  customerUnit,
  demands,
  patterns,
  comparison,
}: {
  customerCount: number;
  customerPoints: CustomerPoint[];
  aggregateUnit: Unit;
  customerUnit: Unit;
  demands: Demands;
  patterns: Patterns;
  comparison?: PropertyComparison<number>;
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

  const baseDisplayValue =
    comparison?.hasChanged && comparison.baseValue != null
      ? String(comparison.baseValue)
      : undefined;

  return (
    <InlineField
      name={translate("connectedCustomers")}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
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
          className="text-left text-size-base p-2 text-default bg-base-hover border border-strong rounded-xs hover:bg-base-active focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-accent aria-expanded:ring-1 aria-expanded:ring-accent w-full flex items-center gap-x-2 tabular-nums"
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
              demands={demands}
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
  demands,
  patterns,
  onClose,
}: {
  customerPoints: CustomerPoint[];
  aggregateUnit: Unit;
  customerUnit: Unit;
  demands: Demands;
  patterns: Patterns;
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
      <div className="font-sans text-subtle dark:text-gray-100 text-size-small text-left py-2 flex font-bold border-b rounded-t">
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
          className="w-full relative rounded-sm"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const customerPoint = customerPoints[virtualRow.index];
            const demand = calculateAverageDemand(
              getCustomerPointDemands(demands, customerPoint.id),
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
                  hover:bg-base-active
                  gap-x-2 even:bg-base-hover dark:even:bg-gray-800"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onMouseEnter={() => handleCustomerPointHover(customerPoint)}
                onMouseLeave={handleCustomerPointLeave}
              >
                <div
                  title={displayValue}
                  className="flex-auto font-mono text-size-small truncate"
                >
                  {displayValue}
                </div>
                <div
                  className="text-size-small font-mono text-subtle dark:text-gray-300"
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

export const SectionWrapper = ({
  title,
  hasChanged,
  section,
  children,
}: {
  title: string;
  hasChanged?: boolean;
  section: keyof AssetPanelSectionExpanded;
  children: React.ReactNode;
}) => {
  const [sections, setSections] = useAtom(assetPanelSectionsExpandedAtom);
  return (
    <CollapsibleSection
      title={title}
      hasChanged={hasChanged}
      open={sections[section]}
      onOpenChange={(open) =>
        setSections((prev) => ({ ...prev, [section]: open }))
      }
      separator={false}
      variant="primary"
    >
      {children}
    </CollapsibleSection>
  );
};
