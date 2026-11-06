import { textColumn, type GridColumn } from "src/components/data-grid";
import { LabelManager, type CustomAttribute } from "@epanet-js/hydraulic-model";
import type { TranslateFn } from "src/hooks/use-translate";
import type { FormattingSpec } from "@epanet-js/project-settings";
import type { ZoneRow } from "./zone-data-table-data";
import {
  customAttributeColumns,
  lockHeaderAction,
  type AttributesLock,
} from "./custom-attribute-columns";

export function buildZoneColumns(
  translate: TranslateFn,
  formatting: FormattingSpec,
  validateLabel: (label: string, row: ZoneRow) => boolean,
  customAttributes: CustomAttribute[] = [],
  customAttributesLock?: AttributesLock,
  labelLock?: AttributesLock,
  labelMaxLength?: number,
): GridColumn<ZoneRow>[] {
  const labelColumn = textColumn<ZoneRow>("label", {
    header: translate("label"),
    validate: validateLabel,
    cleanLabel: (raw) =>
      LabelManager.sanitizeLabel(raw, "zone", labelMaxLength),
    isReadOnly: !!labelLock,
  });
  if (labelLock) {
    labelColumn.meta = {
      ...labelColumn.meta,
      customHeaderActions: [lockHeaderAction(labelLock, translate)],
    };
  }

  return [
    labelColumn,
    ...customAttributeColumns<ZoneRow>(
      customAttributes,
      formatting,
      translate,
      customAttributesLock,
    ),
  ];
}
