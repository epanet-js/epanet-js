import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import { nanoid } from "nanoid";
import { useMapThemesTransaction } from "src/hooks/persistence/use-map-themes-transaction";
import {
  activeMapThemeIdAtom,
  applyMapThemeSymbologyAtom,
  currentMapThemeSpecAtom,
  mapThemesAtom,
  markMapThemeAppliedAtom,
  resetMapThemeChangesAtom,
} from "src/state/map-themes";

export const useApplyMapTheme = () => {
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

export const useSaveMapThemeAsNew = () => {
  const { save, setActive } = useMapThemesTransaction();

  return useAtomCallback(
    useCallback(
      (get, set, name: string): boolean => {
        const theme = {
          id: nanoid(),
          name,
          spec: get(currentMapThemeSpecAtom),
        };
        if (!save(theme)) return false;

        setActive(theme.id);
        set(markMapThemeAppliedAtom);
        return true;
      },
      [save, setActive],
    ),
  );
};

export const useSaveMapThemeChanges = () => {
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
        return true;
      },
      [save],
    ),
  );
};

export const useResetMapThemeChanges = () =>
  useAtomCallback(
    useCallback((_get, set) => {
      set(resetMapThemeChangesAtom);
    }, []),
  );

export const useRenameMapTheme = () => useMapThemesTransaction().rename;

export const useDuplicateMapTheme = () => {
  const { save } = useMapThemesTransaction();
  const applyMapTheme = useApplyMapTheme();

  return useAtomCallback(
    useCallback(
      (get, _set, { id, name }: { id: string; name: string }): boolean => {
        const source = get(mapThemesAtom).find((t) => t.id === id);
        if (!source) return false;
        const copy = { id: nanoid(), name, spec: source.spec };
        if (!save(copy)) return false;

        applyMapTheme(copy.id);
        return true;
      },
      [save, applyMapTheme],
    ),
  );
};

export const useDeleteMapTheme = () => {
  const { remove } = useMapThemesTransaction();
  const applyMapTheme = useApplyMapTheme();

  return useAtomCallback(
    useCallback(
      (get, _set, id: string) => {
        const wasActive = get(activeMapThemeIdAtom) === id;
        remove(id);
        if (wasActive) applyMapTheme(null);
      },
      [remove, applyMapTheme],
    ),
  );
};
