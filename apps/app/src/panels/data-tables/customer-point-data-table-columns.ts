import {
  floatColumn,
  integerColumn,
  filterableSelectColumn,
  textColumn,
  type GridColumn,
} from "src/components/data-grid";
import type { TranslateFn } from "src/hooks/use-translate";
import type { useTranslateUnit } from "src/hooks/use-translate-unit";
import { getDecimals } from "src/lib/project-settings";
import type {
  FormattingSpec,
  UnitsSpec,
} from "src/lib/project-settings/quantities-spec";
import type { CustomerPointRow } from "./customer-point-data-table-data";

type TranslateUnitFn = ReturnType<typeof useTranslateUnit>;

export type PatternOption = { value: number; label: string };

export function buildCustomerPointColumns(
  translate: TranslateFn,
  translateUnit: TranslateUnitFn,
  units: UnitsSpec,
  formatting: FormattingSpec,
  patternOptions: PatternOption[],
  validateLabel: (label: string, rowIndex: number) => boolean,
): GridColumn<CustomerPointRow>[] {
  const headerLabel = (
    name: string,
    unit: Parameters<TranslateUnitFn>[0] = null,
  ) => {
    const unitLabel = translateUnit(unit);
    return unitLabel ? `${name} (${unitLabel})` : name;
  };

  return [
    textColumn<CustomerPointRow>("label", {
      header: translate("label"),
      validate: validateLabel,
    }),
    textColumn<CustomerPointRow>("connectedPipeLabel", {
      header: translate("pipe"),
      isReadOnly: true,
    }),
    textColumn<CustomerPointRow>("connectedJunctionLabel", {
      header: translate("junction"),
      isReadOnly: true,
    }),
    floatColumn<CustomerPointRow>("avgDemand", {
      header: headerLabel(
        translate("customerDemand"),
        units.customerDemandPerDay,
      ),
      decimals: getDecimals(formatting, "customerDemandPerDay"),
      isReadOnly: true,
    }),
    integerColumn<CustomerPointRow>("demandsCount", {
      header: translate("demandsCount"),
      isReadOnly: true,
    }),
    floatColumn<CustomerPointRow>("baseDemand", {
      header: headerLabel(translate("baseDemand"), units.customerDemandPerDay),
      decimals: getDecimals(formatting, "customerDemandPerDay"),
      nullValue: 0,
      deleteValue: 0,
    }),
    filterableSelectColumn<number, CustomerPointRow>("patternId", {
      header: translate("timePattern"),
      options: patternOptions,
      placeholder: translate("constant"),
      emptyOptionLabel: translate("constant"),
      deleteValue: null,
    }),
  ];
}
