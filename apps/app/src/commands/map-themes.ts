import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import { nanoid } from "nanoid";
import { useUserTracking } from "src/infra/user-tracking";
import { useMapThemesTransaction } from "src/hooks/persistence/use-map-themes-transaction";
import {
  activeMapThemeIdAtom,
  applyMapThemeSymbologyAtom,
  currentMapThemeSpecAtom,
  isMapThemeModifiedAtom,
  mapThemesAtom,
  markMapThemeAppliedAtom,
  resetMapThemeChangesAtom,
} from "src/state/map-themes";

const useSwitchMapTheme = () => {
  const { setActive } = useMapThemesTransaction();

  return useAtomCallback(
    useCallback(
      (get, set, id: string | null) => {
        const theme = get(mapThemesAtom).find((t) => t.id === id) ?? null;
        set(applyMapThemeSymbologyAtom, theme);
        setActive(theme ? theme.id : null);
      },
      [setActive],
    ),
  );
};

export const useApplyMapTheme = () => {
  const userTracking = useUserTracking();
  const switchMapTheme = useSwitchMapTheme();

  return useCallback(
    (id: string | null) => {
      switchMapTheme(id);
      userTracking.capture({
        name: "mapTheme.applied",
        isDefault: id === null,
        source: "panel",
      });
    },
    [switchMapTheme, userTracking],
  );
};

export const useSaveMapThemeAsNew = () => {
  const userTracking = useUserTracking();
  const { save, setActive } = useMapThemesTransaction();

  return useAtomCallback(
    useCallback(
      (get, set, name: string): boolean => {
        const activeId = get(activeMapThemeIdAtom);
        const isFromTheme = get(mapThemesAtom).some((t) => t.id === activeId);
        const origin = !isFromTheme
          ? "default"
          : get(isMapThemeModifiedAtom)
            ? "modifiedTheme"
            : "duplicate";
        const theme = {
          id: nanoid(),
          name,
          spec: get(currentMapThemeSpecAtom),
        };
        if (!save(theme)) return false;

        setActive(theme.id);
        set(markMapThemeAppliedAtom);
        userTracking.capture({
          name: "mapTheme.created",
          origin,
          totalThemes: get(mapThemesAtom).length,
          source: "panel",
        });
        return true;
      },
      [save, setActive, userTracking],
    ),
  );
};

export const useSaveMapThemeChanges = () => {
  const userTracking = useUserTracking();
  const { save } = useMapThemesTransaction();

  return useAtomCallback(
    useCallback(
      (get, set): boolean => {
        const id = get(activeMapThemeIdAtom);
        const theme = get(mapThemesAtom).find((t) => t.id === id);
        if (!theme) return false;
        if (!save({ ...theme, spec: get(currentMapThemeSpecAtom) }))
          return false;

        set(markMapThemeAppliedAtom);
        userTracking.capture({ name: "mapTheme.saved", source: "panel" });
        return true;
      },
      [save, userTracking],
    ),
  );
};

export const useResetMapThemeChanges = () => {
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (get, set) => {
        const activeId = get(activeMapThemeIdAtom);
        const isDefault = !get(mapThemesAtom).some((t) => t.id === activeId);
        set(resetMapThemeChangesAtom);
        userTracking.capture({
          name: "mapTheme.changesDiscarded",
          isDefault,
          source: "panel",
        });
      },
      [userTracking],
    ),
  );
};

export const useRenameMapTheme = () => {
  const userTracking = useUserTracking();
  const { rename } = useMapThemesTransaction();

  return useCallback(
    ({ id, name }: { id: string; name: string }): boolean => {
      if (!rename({ id, name })) return false;

      userTracking.capture({ name: "mapTheme.renamed", source: "panel" });
      return true;
    },
    [rename, userTracking],
  );
};

export const useDeleteMapTheme = () => {
  const userTracking = useUserTracking();
  const { remove } = useMapThemesTransaction();
  const switchMapTheme = useSwitchMapTheme();

  return useAtomCallback(
    useCallback(
      (get, _set, id: string) => {
        const wasActive = get(activeMapThemeIdAtom) === id;
        remove(id);
        if (wasActive) switchMapTheme(null);
        userTracking.capture({
          name: "mapTheme.deleted",
          wasActive,
          source: "panel",
        });
      },
      [remove, switchMapTheme, userTracking],
    ),
  );
};
