import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { Setter } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { nanoid } from "nanoid";
import * as db from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import {
  type SelectionSetGroup,
  type SelectionSetGroupId,
  deleteGroupSubtree,
} from "src/lib/collections";
import { writeQueue } from "src/lib/persistence/write-queue";
import { dialogAtom } from "src/state/dialog";
import {
  selectionSetGroupsAtom,
  selectionSetsAtom,
} from "src/state/collections";
import { projectDataVersionAtom } from "src/state/project-revision";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

const markUnsaved = (
  set: Setter,
  write: () => Promise<void>,
  onWriteFailure: (error: unknown) => void,
) => {
  set(projectDataVersionAtom, nanoid());
  writeQueue.enqueue(write, onWriteFailure);
};

export const useSelectionSetGroupsTransaction = () => {
  const setDialog = useSetAtom(dialogAtom);
  const onWriteFailure = useWriteFailureHandler();

  const isStorable = useCallback(
    (group: SelectionSetGroup): boolean => {
      try {
        db.serializeSelectionSetGroup(group);
        return true;
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return false;
      }
    },
    [setDialog],
  );

  const create = useAtomCallback(
    useCallback(
      (_get, set, group: SelectionSetGroup): boolean => {
        if (!isStorable(group)) return false;

        set(selectionSetGroupsAtom, (groups) => [...groups, group]);
        markUnsaved(
          set,
          () => db.insertSelectionSetGroup(group),
          onWriteFailure,
        );

        return true;
      },
      [isStorable, onWriteFailure],
    ),
  );

  const remove = useAtomCallback(
    useCallback(
      (get, set, id: SelectionSetGroupId) => {
        const { groups, sets, removedGroupIds } = deleteGroupSubtree(
          get(selectionSetGroupsAtom),
          get(selectionSetsAtom),
          id,
        );
        set(selectionSetGroupsAtom, groups);
        set(selectionSetsAtom, sets);
        markUnsaved(
          set,
          () => db.deleteSelectionSetGroups(removedGroupIds),
          onWriteFailure,
        );
      },
      [onWriteFailure],
    ),
  );

  return { create, remove };
};
