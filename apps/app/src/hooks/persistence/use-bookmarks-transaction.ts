import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { nanoid } from "nanoid";
import * as db from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import type { Bookmark } from "src/lib/collections";
import { writeQueue } from "src/lib/persistence/write-queue";
import { dialogAtom } from "src/state/dialog";
import { bookmarksAtom } from "src/state/collections";
import { projectDataVersionAtom } from "src/state/project-revision";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

export const useBookmarksTransaction = () => {
  const setBookmarks = useSetAtom(bookmarksAtom);
  const setProjectDataVersion = useSetAtom(projectDataVersionAtom);
  const setDialog = useSetAtom(dialogAtom);
  const onWriteFailure = useWriteFailureHandler();
  const isCollectionsOn = useFeatureFlag("FLAG_SELECTION_SETS");

  const transact = useCallback(
    (next: Bookmark[]): boolean => {
      try {
        db.serializeBookmarks(next);
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return false;
      }

      setBookmarks(next);
      if (isCollectionsOn) {
        setProjectDataVersion(nanoid());
        writeQueue.enqueue(() => db.saveBookmarks(next), onWriteFailure);
      }

      return true;
    },
    [
      setBookmarks,
      setProjectDataVersion,
      setDialog,
      isCollectionsOn,
      onWriteFailure,
    ],
  );

  return { transact };
};
