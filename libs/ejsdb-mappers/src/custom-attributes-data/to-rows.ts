import type { CustomAttributesData } from "@epanet-js/custom-attributes";
import {
  customAttributesDataSchema,
  customAttributesDataRowSchema,
  parseRows,
  type CustomAttributesDataObject,
  type CustomAttributesDataRow,
} from "@epanet-js/ejsdb";

const toRow = (
  assetId: number,
  values: Map<string, string | number | null>,
): CustomAttributesDataRow => {
  const data: CustomAttributesDataObject = {};
  for (const [attributeId, value] of values) {
    data[attributeId] = value;
  }
  const result = customAttributesDataSchema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `Custom attributes data: data does not match schema — ${result.error.message}`,
    );
  }
  return { asset_id: assetId, data: JSON.stringify(result.data) };
};

export const customAttributesDataToRows = (
  data: CustomAttributesData,
  assetIds?: Iterable<number>,
): CustomAttributesDataRow[] => {
  const rows: CustomAttributesDataRow[] = [];
  const ids = assetIds ?? data.keys();
  for (const assetId of ids) {
    const values = data.get(assetId);
    if (values && values.size > 0) {
      rows.push(toRow(assetId, values));
    }
  }
  return rows;
};

export const serializeCustomAttributesData = (
  data: CustomAttributesData,
  assetIds?: Iterable<number>,
): CustomAttributesDataRow[] =>
  parseRows(
    customAttributesDataRowSchema,
    customAttributesDataToRows(data, assetIds),
    "Custom attributes data",
  );
