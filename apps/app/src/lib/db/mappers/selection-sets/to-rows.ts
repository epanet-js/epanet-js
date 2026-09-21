import {
  encodeIdList,
  parseRows,
  selectionSetRowSchema,
  type SelectionSetRow,
} from "@epanet-js/ejsdb";
import type { SelectionSet } from "src/lib/collections";
import { USelection } from "src/selection";

export const selectionSetToRow = (
  selectionSet: SelectionSet,
): SelectionSetRow => ({
  id: selectionSet.id,
  label: selectionSet.label,
  assets: encodeIdList(USelection.getAssetIds(selectionSet.selection)),
  customer_points: encodeIdList(
    USelection.getCustomerPointIds(selectionSet.selection),
  ),
});

export const serializeSelectionSets = (
  selectionSets: readonly SelectionSet[],
): SelectionSetRow[] =>
  parseRows(
    selectionSetRowSchema,
    selectionSets.map(selectionSetToRow),
    "Selection set",
  );

export const serializeSelectionSet = (
  selectionSet: SelectionSet,
): SelectionSetRow => serializeSelectionSets([selectionSet])[0];
