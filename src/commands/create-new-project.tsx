import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/jotai";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { useUserTracking } from "src/infra/user-tracking";

export const createNewShortcut = "alt+n";

export const useNewProject = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const createNew = useCallback(
    ({ source }: { source: string }) => {
      userTracking.capture({
        name: "newModel.started",
        source,
      });
      setDialogState({ type: "createNew" });
    },
    [setDialogState, userTracking],
  );

  return useCallback(
    ({ source }: { source: string }) => {
      checkUnsavedChanges(() => createNew({ source }));
    },
    [checkUnsavedChanges, createNew],
  );
};
