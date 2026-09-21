import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { Setter } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { nanoid } from "nanoid";
import * as db from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  type SelectionSet,
  type SelectionSetId,
  removeItem,
  renameItem,
} from "src/lib/collections";
import { writeQueue } from "src/lib/persistence/write-queue";
import { dialogAtom } from "src/state/dialog";
import { selectionSetsAtom } from "src/state/collections";
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

export const useSelectionSetsTransaction = () => {
  const setDialog = useSetAtom(dialogAtom);
  const onWriteFailure = useWriteFailureHandler();
  const isCollectionsOn = useFeatureFlag("FLAG_SELECTION_SETS");

  const isStorable = useCallback(
    (selectionSet: SelectionSet): boolean => {
      try {
        db.serializeSelectionSet(selectionSet);
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
      (_get, set, selectionSet: SelectionSet): boolean => {
        if (!isStorable(selectionSet)) return false;

        set(selectionSetsAtom, (selectionSets) => [
          ...selectionSets,
          selectionSet,
        ]);
        if (isCollectionsOn) {
          markUnsaved(
            set,
            () => db.insertSelectionSet(selectionSet),
            onWriteFailure,
          );
        }

        return true;
      },
      [isStorable, isCollectionsOn, onWriteFailure],
    ),
  );

  const rename = useAtomCallback(
    useCallback(
      (
        get,
        set,
        { id, label }: { id: SelectionSetId; label: string },
      ): boolean => {
        const current = get(selectionSetsAtom).find(
          (selectionSet) => selectionSet.id === id,
        );
        if (!current) return false;
        if (!isStorable({ ...current, label })) return false;

        set(selectionSetsAtom, (selectionSets) =>
          renameItem(selectionSets, id, label),
        );
        if (isCollectionsOn) {
          markUnsaved(
            set,
            () => db.renameSelectionSet(id, label),
            onWriteFailure,
          );
        }

        return true;
      },
      [isStorable, isCollectionsOn, onWriteFailure],
    ),
  );

  const remove = useAtomCallback(
    useCallback(
      (_get, set, id: SelectionSetId) => {
        set(selectionSetsAtom, (selectionSets) =>
          removeItem(selectionSets, id),
        );
        if (isCollectionsOn) {
          markUnsaved(set, () => db.deleteSelectionSet(id), onWriteFailure);
        }
      },
      [isCollectionsOn, onWriteFailure],
    ),
  );

  return { create, rename, remove };
};
