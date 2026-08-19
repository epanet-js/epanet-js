import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog";
import { useHasUnsavedChanges } from "src/hooks/use-has-unsaved-changes";

export const useUnsavedChangesCheck = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const hasUnsavedChanges = useHasUnsavedChanges();

  return useCallback(
    (onContinue: () => void) => {
      if (hasUnsavedChanges) {
        return setDialogState({
          type: "unsavedChanges",
          onContinue,
        });
      }

      void onContinue();
    },
    [hasUnsavedChanges, setDialogState],
  );
};
