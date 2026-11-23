import { useCallback, useMemo } from "react";
import { useAtomCallback } from "jotai/utils";
import {
  useUserTracking,
  type MapThemeChange,
  type MapThemeEditContext,
} from "src/infra/user-tracking";
import {
  activeMapThemeIdAtom,
  isMapThemeModifiedAtom,
  mapThemesAtom,
} from "src/state/map-themes";

export const useMapThemeEditTracking = () => {
  const userTracking = useUserTracking();

  const readContext = useAtomCallback(
    useCallback((get): MapThemeEditContext => {
      const activeId = get(activeMapThemeIdAtom);
      return {
        isDefault: !get(mapThemesAtom).some((t) => t.id === activeId),
        hadUnsavedChanges: get(isMapThemeModifiedAtom),
      };
    }, []),
  );

  const captureChange = useCallback(
    (change: MapThemeChange, context: MapThemeEditContext = readContext()) => {
      userTracking.capture({ name: "mapTheme.changed", ...change, ...context });
    },
    [readContext, userTracking],
  );

  return useMemo(
    () => ({ captureChange, readContext }),
    [captureChange, readContext],
  );
};
