import { useMemo, useCallback } from "react";
import {
  DataGrid,
  type GridColumn,
  type RowAction,
  textColumn,
  filterableSelectColumn,
} from "src/components/data-grid";
import { useTranslate } from "src/hooks/use-translate";
import { DeleteIcon } from "src/icons";
import {
  CustomAttribute,
  CustomAttributeType,
  customAttributeTypes,
  duplicateLabelKeys,
  normalizeLabel,
} from "src/lib/custom-attributes";

type CustomAttributesTableProps = {
  attributes: CustomAttribute[];
  onChange: (attributes: CustomAttribute[]) => void;
  makeId: () => string;
  readOnly?: boolean;
};

const TYPE_TRANSLATION_KEYS: Record<CustomAttributeType, string> = {
  text: "customAttributes.typeText",
  number: "customAttributes.typeNumber",
};

export const CustomAttributesTable = ({
  attributes,
  onChange,
  makeId,
  readOnly = false,
}: CustomAttributesTableProps) => {
  const translate = useTranslate();

  const typeOptions = useMemo(
    () =>
      customAttributeTypes.map((type) => ({
        value: type,
        label: translate(TYPE_TRANSLATION_KEYS[type]),
      })),
    [translate],
  );

  const columns: GridColumn<CustomAttribute>[] = useMemo(
    () => [
      textColumn<CustomAttribute>("label", {
        header: translate("customAttributes.label"),
        size: 200,
        emptyValue: "",
      }),
      filterableSelectColumn<CustomAttributeType, CustomAttribute>("type", {
        header: translate("customAttributes.type"),
        size: 120,
        options: typeOptions,
        emptyValue: "text",
      }),
    ],
    [translate, typeOptions],
  );

  const createRow = useCallback((): CustomAttribute => {
    const used = new Set(attributes.map((attribute) => attribute.label));
    let number = 1;
    let label = translate("customAttributes.defaultLabel", String(number));
    while (used.has(label)) {
      number += 1;
      label = translate("customAttributes.defaultLabel", String(number));
    }
    return { id: makeId(), label, type: "text" };
  }, [attributes, translate, makeId]);

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      onChange(attributes.filter((_, index) => index !== rowIndex));
    },
    [attributes, onChange],
  );

  const handleDelete = useCallback(
    (rowsToDelete: CustomAttribute[]) => {
      const toRemove = new Set(rowsToDelete);
      onChange(attributes.filter((attribute) => !toRemove.has(attribute)));
    },
    [attributes, onChange],
  );

  const rowActions: RowAction[] = useMemo(
    () => [
      {
        label: translate("delete"),
        icon: <DeleteIcon size="sm" />,
        variant: "destructive" as const,
        onSelect: handleDeleteRow,
      },
    ],
    [translate, handleDeleteRow],
  );

  const duplicateKeys = useMemo(
    () => duplicateLabelKeys(attributes),
    [attributes],
  );

  const cellHasWarning = useCallback(
    (rowIndex: number, columnId: string) => {
      if (columnId !== "label") return false;
      const label = attributes[rowIndex]?.label ?? "";
      if (!label.trim()) return true;
      return duplicateKeys.has(normalizeLabel(label));
    },
    [attributes, duplicateKeys],
  );

  return (
    <DataGrid<CustomAttribute>
      data={attributes}
      columns={columns}
      onChange={onChange}
      onDelete={handleDelete}
      createRow={createRow}
      rowActions={rowActions}
      addRowLabel={translate("customAttributes.addAttribute")}
      gutterColumn="numbered"
      variant="spreadsheet"
      readOnly={readOnly}
      cellHasWarning={cellHasWarning}
    />
  );
};
