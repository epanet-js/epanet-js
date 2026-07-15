import type { ReactNode } from "react";
import {
  floatColumn,
  integerColumn,
  filterableSelectColumn,
  textColumn,
  type GridColumn,
  type ColumnKey,
} from "src/components/data-grid";
import type { CustomHeaderAction } from "src/components/data-grid/features";
import { LabelManager, type CustomerPoint } from "@epanet-js/hydraulic-model";
import type { CustomAttribute } from "@epanet-js/hydraulic-model";
import { convertTo } from "@epanet-js/quantity";
import type { TranslateFn } from "src/hooks/use-translate";
import type { useTranslateUnit } from "src/hooks/use-translate-unit";
import { getDecimals } from "src/lib/project-settings";
import type {
  FormattingSpec,
  UnitsSpec,
} from "src/lib/project-settings/quantities-spec";
import {
  type CustomerPointRow,
  type CpAccessorCtx,
  cpAccessor,
  isCpComputedKey,
} from "./customer-point-data-table-data";

type TranslateUnitFn = ReturnType<typeof useTranslateUnit>;

export type PatternOption = { value: number; label: string };

type AttributesLock = {
  openPaywall: () => void;
  icon: ReactNode;
};

function makeCk(accessorCtx?: CpAccessorCtx) {
  return (key: keyof CustomerPointRow): ColumnKey<CustomerPointRow, never> => {
    if (accessorCtx && isCpComputedKey(key)) {
      return {
        id: key,
        accessorFn: cpAccessor(key, accessorCtx) as (
          row: CustomerPointRow,
        ) => never,
      };
    }
    return key;
  };
}

export function buildCustomerPointColumns(
  translate: TranslateFn,
  translateUnit: TranslateUnitFn,
  units: UnitsSpec,
  formatting: FormattingSpec,
  patternOptions: PatternOption[],
  validateLabel: (label: string, row: CustomerPointRow) => boolean,
  accessorCtx?: CpAccessorCtx,
  customAttributes: CustomAttribute[] = [],
  customAttributesLock?: AttributesLock,
): GridColumn<CustomerPointRow>[] {
  const ck = makeCk(accessorCtx);
  const headerLabel = (
    name: string,
    unit: Parameters<TranslateUnitFn>[0] = null,
  ) => {
    const unitLabel = translateUnit(unit);
    return unitLabel ? `${name} (${unitLabel})` : name;
  };

  const demandTransforms = accessorCtx
    ? {
        toDisplay: (stored: number) =>
          convertTo(
            { value: stored, unit: units.customerDemand },
            units.customerDemandPerDay,
          ),
        fromDisplay: (displayed: number) =>
          convertTo(
            { value: displayed, unit: units.customerDemandPerDay },
            units.customerDemand,
          ),
      }
    : {};

  const columns = [
    textColumn<CustomerPointRow>(ck("label"), {
      header: translate("label"),
      validate: validateLabel,
      cleanLabel: (raw) => LabelManager.sanitizeLabel(raw, "customerPoint"),
    }),
    textColumn<CustomerPointRow>(ck("connectedPipeLabel"), {
      header: translate("pipe"),
      isReadOnly: true,
    }),
    textColumn<CustomerPointRow>(ck("connectedJunctionLabel"), {
      header: translate("junction"),
      isReadOnly: true,
    }),
    floatColumn<CustomerPointRow>(ck("avgDemand"), {
      header: headerLabel(
        translate("customerDemand"),
        units.customerDemandPerDay,
      ),
      decimals: getDecimals(formatting, "customerDemandPerDay"),
      isReadOnly: true,
      ...demandTransforms,
    }),
    integerColumn<CustomerPointRow>(ck("demandsCount"), {
      header: translate("demandsCount"),
      isReadOnly: true,
    }),
    floatColumn<CustomerPointRow>(ck("baseDemand"), {
      header: headerLabel(translate("baseDemand"), units.customerDemandPerDay),
      decimals: getDecimals(formatting, "customerDemandPerDay"),
      emptyValue: 0,
      ...demandTransforms,
    }),
    filterableSelectColumn<number, CustomerPointRow>(ck("patternId"), {
      header: translate("timePattern"),
      options: patternOptions,
      placeholder: translate("constant"),
      emptyOptionLabel: translate("constant"),
      emptyValue: null,
    }),
    ...customAttributeColumns(
      customAttributes,
      formatting,
      translate,
      customAttributesLock,
    ),
  ];

  return columns;
}

function customAttributeColumns(
  attributes: CustomAttribute[],
  formatting: FormattingSpec,
  translate: TranslateFn,
  lock?: AttributesLock,
): GridColumn<CustomerPointRow>[] {
  const headerAction: CustomHeaderAction | undefined = lock
    ? {
        icon: lock.icon,
        ariaLabel: translate("paywall.tooltip"),
        tooltip: translate("paywall.tooltip"),
        onClick: lock.openPaywall,
        alwaysVisible: true,
      }
    : undefined;
  return attributes.map((attribute) => {
    const key = attribute.id;
    const columnKey: ColumnKey<CustomerPointRow, never> = {
      id: key,
      accessorFn: ((row: CustomerPointRow) =>
        (row as unknown as CustomerPoint).getProperty(key) ?? null) as (
        row: CustomerPointRow,
      ) => never,
    };
    const column =
      attribute.type === "number"
        ? floatColumn(columnKey, {
            header: attribute.label,
            decimals: formatting.defaultDecimals,
            emptyValue: null,
            isReadOnly: !!lock,
          })
        : textColumn(columnKey, {
            header: attribute.label,
            emptyValue: null,
            isReadOnly: !!lock,
          });
    if (headerAction) {
      column.meta = {
        ...column.meta,
        customHeaderActions: [headerAction],
      };
    }
    return column;
  });
}
