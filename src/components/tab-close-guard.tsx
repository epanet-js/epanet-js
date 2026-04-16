import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { hasUnsavedChangesDerivedAtom } from "src/state/derived-branch-state";

export const TabCloseGuard = () => {
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesDerivedAtom);

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
