import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { Setter } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { nanoid } from "nanoid";
import * as db from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import { writeQueue } from "src/lib/persistence/write-queue";
import { dialogAtom } from "src/state/dialog";
import {
  activeMapThemeIdAtom,
  mapThemesAtom,
  type MapTheme,
} from "src/state/map-themes";
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

export const useMapThemesTransaction = () => {
  const setDialog = useSetAtom(dialogAtom);
  const onWriteFailure = useWriteFailureHandler();

  const isStorable = useCallback(
    (theme: MapTheme): boolean => {
      try {
        db.serializeMapTheme(theme);
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
      (get, set, theme: MapTheme): boolean => {
        if (!isStorable(theme)) return false;

        const exists = get(mapThemesAtom).some(({ id }) => id === theme.id);
        set(mapThemesAtom, (themes) =>
          exists
            ? themes.map((existing) =>
                existing.id === theme.id ? theme : existing,
              )
            : [...themes, theme],
        );
        markUnsaved(set, () => db.saveMapTheme(theme), onWriteFailure);

        return true;
      },
      [isStorable, onWriteFailure],
    ),
  );

  const rename = useAtomCallback(
    useCallback(
      (get, set, { id, name }: { id: string; name: string }): boolean => {
        const current = get(mapThemesAtom).find((theme) => theme.id === id);
        if (!current) return false;
        const renamed = { ...current, name };
        if (!isStorable(renamed)) return false;

        set(mapThemesAtom, (themes) =>
          themes.map((theme) => (theme.id === id ? renamed : theme)),
        );
        markUnsaved(set, () => db.saveMapTheme(renamed), onWriteFailure);

        return true;
      },
      [isStorable, onWriteFailure],
    ),
  );

  const remove = useAtomCallback(
    useCallback(
      (_get, set, id: string) => {
        set(mapThemesAtom, (themes) =>
          themes.filter((theme) => theme.id !== id),
        );
        markUnsaved(set, () => db.deleteMapTheme(id), onWriteFailure);
      },
      [onWriteFailure],
    ),
  );

  const setActive = useAtomCallback(
    useCallback(
      (get, set, id: string | null) => {
        if (get(activeMapThemeIdAtom) === id) return;

        set(activeMapThemeIdAtom, id);
        markUnsaved(set, () => db.saveActiveMapThemeId(id), onWriteFailure);
      },
      [onWriteFailure],
    ),
  );

  return { save, rename, remove, setActive };
};
