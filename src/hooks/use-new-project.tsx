import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom, hasUnsavedChangesAtom } from "src/state/jotai";
import { isFeatureOn } from "src/infra/feature-flags";

export const useNewProject = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);

  const createNew = () => {
    if (isFeatureOn("FLAG_NEW_FORM")) {
      setDialogState({ type: "createNew" });
    } else {
      window.location.reload();
    }
  };

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
    [setDialogState, hasUnsavedChanges],
  );
};
