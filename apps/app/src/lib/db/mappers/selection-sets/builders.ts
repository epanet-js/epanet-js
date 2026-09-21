import {
  decodeIdList,
  parseRows,
  selectionSetRowSchema,
} from "@epanet-js/ejsdb";
import type { SelectionSet } from "src/lib/collections";
import { USelection } from "src/selection";

export const buildSelectionSetsData = (rawRows: unknown[]): SelectionSet[] => {
  const rows = parseRows(selectionSetRowSchema, rawRows, "Selection set");

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    selection: USelection.fromIds(
      decodeIdList(row.assets),
      decodeIdList(row.customer_points),
    ),
  }));
};
