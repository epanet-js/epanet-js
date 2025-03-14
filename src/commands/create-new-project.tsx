import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/jotai";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";

export const createNewShortcut = "alt+n";

export const useNewProject = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const setDialogState = useSetAtom(dialogAtom);

  const createNew = useCallback(() => {
    setDialogState({ type: "createNew" });
  }, [setDialogState]);

  return useCallback(() => {
    checkUnsavedChanges(() => createNew());
  }, [checkUnsavedChanges, createNew]);
};
