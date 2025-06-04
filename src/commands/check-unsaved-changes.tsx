import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog";
import { hasUnsavedChangesAtom } from "src/state/jotai";

export const useUnsavedChangesCheck = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);

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
