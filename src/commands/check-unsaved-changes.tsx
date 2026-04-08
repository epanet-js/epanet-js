import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog";
import { hasUnsavedChangesAtom } from "src/state/model-changes";
import { hasUnsavedChangesDerivedAtom } from "src/state/derived-branch-state";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const useUnsavedChangesCheck = () => {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const setDialogState = useSetAtom(dialogAtom);
  const hasUnsavedChanges = useAtomValue(
    isStateRefactorOn ? hasUnsavedChangesDerivedAtom : hasUnsavedChangesAtom,
  );

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
