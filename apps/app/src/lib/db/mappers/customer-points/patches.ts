import type { CustomerPointPatch } from "src/hydraulic-model/model-operation";
import type { CustomerPointId } from "@epanet-js/hydraulic-model";
import {
  customerPointPatchRowSchema,
  type CustomerPointPatchRow,
} from "@epanet-js/ejsdb";

type ColumnMap = Record<
  string,
  { col: string; transform?: (v: unknown) => unknown }
>;

const customerPointMap: ColumnMap = {
  label: { col: "label" },
};

export const customerPointPatchesToRows = (
  patches: readonly CustomerPointPatch[],
): CustomerPointPatchRow[] => {
  const rows: CustomerPointPatchRow[] = [];
  for (const patch of patches) {
    const candidate = buildPatchObject(
      patch.id,
      patch.properties,
      customerPointMap,
    );
    if (Object.keys(candidate).length <= 1) continue;
    const result = customerPointPatchRowSchema.safeParse(candidate);
    if (!result.success) {
      throw new Error(
        `Customer point ${patch.id} patch: row does not match schema — ${result.error.message}`,
      );
    }
    rows.push(result.data);
  }
  return rows;
};

const buildPatchObject = (
  id: CustomerPointId,
  properties: Record<string, unknown>,
  map: ColumnMap,
): Record<string, unknown> => {
  const row: Record<string, unknown> = { id };
  for (const key in properties) {
    const entry = map[key];
    if (!entry) continue;
    const value = properties[key];
    row[entry.col] = entry.transform ? entry.transform(value) : value;
  }
  return row;
};
