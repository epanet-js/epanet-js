import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom, hasUnsavedChangesAtom } from "src/state/jotai";

export const useNewProject = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);

  const createNew = useCallback(() => {
    setDialogState({ type: "createNew" });
  }, [setDialogState]);

  return useCallback(
    ({ needsConfirm = true } = {}) => {
      if (hasUnsavedChanges && needsConfirm) {
        return setDialogState({
          type: "unsavedChanges",
          onContinue: createNew,
        });
      }

      createNew();
    },
    [setDialogState, hasUnsavedChanges, createNew],
  );
};
