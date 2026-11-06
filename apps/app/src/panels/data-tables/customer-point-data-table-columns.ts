import {
  floatColumn,
  integerColumn,
  filterableSelectColumn,
  textColumn,
  type GridColumn,
  type ColumnKey,
} from "src/components/data-grid";
import { LabelManager, type CustomAttribute } from "@epanet-js/hydraulic-model";
import { convertTo } from "@epanet-js/quantity";
import type { TranslateFn } from "src/hooks/use-translate";
import type { useTranslateUnit } from "src/hooks/use-translate-unit";
import { getDecimals } from "@epanet-js/project-settings";
import type { FormattingSpec, UnitsSpec } from "@epanet-js/project-settings";
import {
  type CustomerPointRow,
  type CpAccessorCtx,
  cpAccessor,
  isCpComputedKey,
} from "./customer-point-data-table-data";
import {
  customAttributeColumns,
  type AttributesLock,
} from "./custom-attribute-columns";

type TranslateUnitFn = ReturnType<typeof useTranslateUnit>;

export type PatternOption = { value: number; label: string };

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
  labelMaxLength?: number,
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
      cleanLabel: (raw) =>
        LabelManager.sanitizeLabel(raw, "customerPoint", labelMaxLength),
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
    ...customAttributeColumns<CustomerPointRow>(
      customAttributes,
      formatting,
      translate,
      customAttributesLock,
    ),
  ];

  return columns;
}
