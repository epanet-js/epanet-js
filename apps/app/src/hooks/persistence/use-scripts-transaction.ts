import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { Setter } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { nanoid } from "nanoid";
import { SCRIPT_API_VERSION } from "@epanet-js/scripting-docs";
import * as db from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import { writeQueue } from "src/lib/persistence/write-queue";
import { dialogAtom } from "src/state/dialog";
import { projectDataVersionAtom } from "src/state/project-revision";
import { userScriptsAtom, type UserScript } from "src/state/scripts";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

const markUnsaved = (
  set: Setter,
  write: () => Promise<void>,
  onWriteFailure: (error: unknown) => void,
) => {
  set(projectDataVersionAtom, nanoid());
  writeQueue.enqueue(write, onWriteFailure);
};

export const useScriptsTransaction = () => {
  const setDialog = useSetAtom(dialogAtom);
  const onWriteFailure = useWriteFailureHandler();

  const isStorable = useCallback(
    (script: UserScript): boolean => {
      try {
        db.serializeScript(script);
        return true;
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return false;
      }
    },
    [setDialog],
  );

  const save = useAtomCallback(
    useCallback(
      (
        _get,
        set,
        script: { id: string | null; name: string; source: string },
      ): UserScript | null => {
        const saved: UserScript = {
          id: script.id ?? nanoid(),
          name: script.name,
          source: script.source,
          apiVersion: SCRIPT_API_VERSION,
          updatedAt: Date.now(),
        };
        if (!isStorable(saved)) return null;

        set(userScriptsAtom, (scripts) => [
          saved,
          ...scripts.filter((existing) => existing.id !== saved.id),
        ]);
        markUnsaved(set, () => db.saveScript(saved), onWriteFailure);

        return saved;
      },
      [isStorable, onWriteFailure],
    ),
  );

  const remove = useAtomCallback(
    useCallback(
      (_get, set, id: string) => {
        set(userScriptsAtom, (scripts) =>
          scripts.filter((script) => script.id !== id),
        );
        markUnsaved(set, () => db.deleteScript(id), onWriteFailure);
      },
      [onWriteFailure],
    ),
  );

  return { save, remove };
};
