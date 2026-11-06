import type { ReactNode } from "react";
import {
  floatColumn,
  textColumn,
  type GridColumn,
  type ColumnKey,
} from "src/components/data-grid";
import type { CustomHeaderAction } from "src/components/data-grid/features";
import type { CustomAttribute } from "@epanet-js/hydraulic-model";
import type { TranslateFn } from "src/hooks/use-translate";
import type { FormattingSpec } from "@epanet-js/project-settings";

export type AttributesLock = {
  openPaywall: () => void;
  icon: ReactNode;
};

type WithProperties = { getProperty: (key: string) => unknown };

export function lockHeaderAction(
  lock: AttributesLock,
  translate: TranslateFn,
): CustomHeaderAction {
  return {
    icon: lock.icon,
    ariaLabel: translate("paywall.tooltip"),
    tooltip: translate("paywall.tooltip"),
    onClick: lock.openPaywall,
    alwaysVisible: true,
  };
}

export function customAttributeColumns<TRow>(
  attributes: CustomAttribute[],
  formatting: FormattingSpec,
  translate: TranslateFn,
  lock?: AttributesLock,
): GridColumn<TRow>[] {
  const headerAction = lock ? lockHeaderAction(lock, translate) : undefined;
  return attributes.map((attribute) => {
    const key = attribute.id;
    const columnKey: ColumnKey<TRow, never> = {
      id: key,
      accessorFn: ((row: TRow) =>
        (row as unknown as WithProperties).getProperty(key) ?? null) as (
        row: TRow,
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
