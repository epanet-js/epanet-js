import {
  type CustomAttributeValues,
  type CustomAttributesData,
  emptyCustomAttributesData,
} from "@epanet-js/custom-attributes";
import {
  customAttributesDataSchema,
  customAttributesDataRowSchema,
  parseRows,
} from "@epanet-js/ejsdb";

export const buildCustomAttributesData = (
  rawRows: unknown[],
): CustomAttributesData => {
  const rows = parseRows(
    customAttributesDataRowSchema,
    rawRows,
    "Custom attributes data",
  );

  const data = emptyCustomAttributesData();
  for (const row of rows) {
    let raw: unknown;
    try {
      raw = JSON.parse(row.data);
    } catch (error) {
      throw new Error("Custom attributes data: data is not valid JSON", {
        cause: error,
      });
    }

    const result = customAttributesDataSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `Custom attributes data: data does not match schema — ${result.error.message}`,
      );
    }

    const values: CustomAttributeValues = new Map();
    for (const [attributeId, value] of Object.entries(result.data)) {
      values.set(attributeId, value);
    }
    if (values.size > 0) {
      data.set(row.asset_id, values);
    }
  }
  return data;
};
