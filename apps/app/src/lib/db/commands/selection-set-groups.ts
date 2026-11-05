import { getWorker, timed } from "@epanet-js/ejsdb";
import type { SelectionSetGroup } from "src/lib/collections";
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
