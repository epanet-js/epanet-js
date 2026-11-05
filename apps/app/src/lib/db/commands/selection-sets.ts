import { getWorker, timed } from "@epanet-js/ejsdb";
import type {
  SelectionSet,
  SelectionSetGroupId,
  SelectionSetId,
} from "src/lib/collections";
import { serializeSelectionSet } from "../mappers/selection-sets/to-rows";

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

export const moveSelectionSet = async (
  id: SelectionSetId,
  groupId: SelectionSetGroupId | null,
): Promise<void> => {
  await timed("moveSelectionSet", async () => {
    await getWorker().moveSelectionSet(id, groupId);
  });
};

export const deleteSelectionSet = async (id: SelectionSetId): Promise<void> => {
  await timed("deleteSelectionSet", async () => {
    await getWorker().deleteSelectionSet(id);
  });
};
