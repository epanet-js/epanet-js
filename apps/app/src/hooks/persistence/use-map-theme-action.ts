import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { captureError } from "src/infra/error-tracking";
import { dialogAtom } from "src/state/dialog";
import { mapThemeActionAtom, type MapThemeAction } from "src/state/map-themes";

export const useMapThemeAction = () => {
  const dispatch = useSetAtom(mapThemeActionAtom);
  const setDialog = useSetAtom(dialogAtom);

  return useCallback(
    (action: MapThemeAction): boolean => {
      try {
        dispatch(action);
        return true;
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return false;
      }
    },
    [dispatch, setDialog],
  );
};
