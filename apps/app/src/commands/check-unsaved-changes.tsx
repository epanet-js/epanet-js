import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog";
import { hasUnsavedChangesDerivedAtom } from "src/state/derived-branch-state";

export const useUnsavedChangesCheck = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesDerivedAtom);

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
