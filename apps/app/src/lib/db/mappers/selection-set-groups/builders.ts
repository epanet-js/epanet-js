import { parseRows, selectionSetGroupRowSchema } from "@epanet-js/ejsdb";
import { type SelectionSetGroup, resolveGroupId } from "src/lib/collections";

export const buildSelectionSetGroupsData = (
  rawRows: unknown[],
): SelectionSetGroup[] => {
  const rows = parseRows(
    selectionSetGroupRowSchema,
    rawRows,
    "Selection set group",
  );

  const groups = rows.map((row) => ({
    id: row.id,
    label: row.label,
    parentId: row.parent_id,
  }));

  return groups.map((group) => ({
    ...group,
    parentId: resolveGroupId(groups, group.parentId),
  }));
};
