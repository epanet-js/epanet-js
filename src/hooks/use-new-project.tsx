import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom, hasUnsavedChangesAtom } from "src/state/jotai";
import { isFeatureOn } from "src/infra/feature-flags";

export const useNewProject = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);

  const createNew = () => {
    window.location.reload();
  };

  return useCallback(
    ({ needsConfirm = true } = {}) => {
      if (isFeatureOn("FLAG_UNSAVED") && hasUnsavedChanges && needsConfirm) {
        return setDialogState({
          type: "unsavedChanges",
          onContinue: createNew,
        });
      }

      createNew();
    },
    [setDialogState, hasUnsavedChanges],
  );
};
