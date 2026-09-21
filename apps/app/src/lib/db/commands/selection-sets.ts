import { getWorker, timed } from "@epanet-js/ejsdb";
import type { SelectionSet, SelectionSetId } from "src/lib/collections";
import {
  selectionSetToRow,
  serializeSelectionSet,
} from "../mappers/selection-sets/to-rows";

export const insertSelectionSet = async (
  selectionSet: SelectionSet,
): Promise<void> => {
  await timed("insertSelectionSet", async () => {
    await getWorker().insertSelectionSet(serializeSelectionSet(selectionSet));
  });
};

export const renameSelectionSet = async (
  id: SelectionSetId,
  label: string,
): Promise<void> => {
  await timed("renameSelectionSet", async () => {
    await getWorker().renameSelectionSet(id, label);
  });
};

export const deleteSelectionSet = async (id: SelectionSetId): Promise<void> => {
  await timed("deleteSelectionSet", async () => {
    await getWorker().deleteSelectionSet(id);
  });
};

export const replaceSelectionSetMembers = async (
  selectionSet: SelectionSet,
): Promise<void> => {
  await timed("replaceSelectionSetMembers", async () => {
    const row = selectionSetToRow(selectionSet);
    await getWorker().replaceSelectionSetMembers(
      row.id,
      row.assets,
      row.customer_points,
    );
  });
};
