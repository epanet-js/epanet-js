import { parseRows, selectionSetGroupRowSchema } from "@epanet-js/ejsdb";
import type { SelectionSetGroup } from "src/lib/collections";

export const buildSelectionSetGroupsData = (
  rawRows: unknown[],
): SelectionSetGroup[] => {
  const rows = parseRows(
    selectionSetGroupRowSchema,
    rawRows,
    "Selection set group",
  );

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    parentId: row.parent_id,
  }));
};
