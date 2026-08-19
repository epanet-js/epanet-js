import { useEffect } from "react";
import { useHasUnsavedChanges } from "src/hooks/use-has-unsaved-changes";

export const TabCloseGuard = () => {
  const hasUnsavedChanges = useHasUnsavedChanges();

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
