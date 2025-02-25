import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { hasUnsavedChangesAtom } from "src/state/jotai";

export const TabCloseGuard = () => {
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);

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
