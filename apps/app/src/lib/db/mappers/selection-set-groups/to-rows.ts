import {
  parseRows,
  selectionSetGroupRowSchema,
  type SelectionSetGroupRow,
} from "@epanet-js/ejsdb";
import type { SelectionSetGroup } from "src/lib/collections";

export const selectionSetGroupToRow = (
  group: SelectionSetGroup,
): SelectionSetGroupRow => ({
  id: group.id,
  label: group.label,
  parent_id: group.parentId,
});

export const serializeSelectionSetGroups = (
  groups: readonly SelectionSetGroup[],
): SelectionSetGroupRow[] =>
  parseRows(
    selectionSetGroupRowSchema,
    groups.map(selectionSetGroupToRow),
    "Selection set group",
  );

export const serializeSelectionSetGroup = (
  group: SelectionSetGroup,
): SelectionSetGroupRow => serializeSelectionSetGroups([group])[0];
