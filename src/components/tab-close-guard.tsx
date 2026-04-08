import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { hasUnsavedChangesAtom } from "src/state/model-changes";
import { hasUnsavedChangesDerivedAtom } from "src/state/derived-branch-state";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const TabCloseGuard = () => {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const hasUnsavedChanges = useAtomValue(
    isStateRefactorOn ? hasUnsavedChangesDerivedAtom : hasUnsavedChangesAtom,
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: Event) => {
      event.preventDefault();
      event.returnValue = false;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  return null;
};
