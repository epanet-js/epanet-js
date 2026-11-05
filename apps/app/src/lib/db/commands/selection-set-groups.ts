import { getWorker, timed } from "@epanet-js/ejsdb";
import type {
  SelectionSetGroup,
  SelectionSetGroupId,
} from "src/lib/collections";
import { serializeSelectionSetGroup } from "../mappers/selection-set-groups/to-rows";

export const insertSelectionSetGroup = async (
  group: SelectionSetGroup,
): Promise<void> => {
  await timed("insertSelectionSetGroup", async () => {
    await getWorker().insertSelectionSetGroup(
      serializeSelectionSetGroup(group),
    );
  });
};

export const deleteSelectionSetGroups = async (
  ids: SelectionSetGroupId[],
): Promise<void> => {
  await timed("deleteSelectionSetGroups", async () => {
    await getWorker().deleteSelectionSetGroups(ids);
  });
};

export const renameSelectionSetGroup = async (
  id: SelectionSetGroupId,
  label: string,
): Promise<void> => {
  await timed("renameSelectionSetGroup", async () => {
    await getWorker().renameSelectionSetGroup(id, label);
  });
};
