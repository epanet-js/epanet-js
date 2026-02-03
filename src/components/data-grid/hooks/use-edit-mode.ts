import { useCallback, useState } from "react";
import { EditMode } from "../types";

export function useEditMode() {
  const [editMode, setEditMode] = useState<EditMode>(false);

  const startEditing = useCallback((mode: "quick" | "full" = "full") => {
    setEditMode(mode);
  }, []);

  const stopEditing = useCallback(() => {
    setEditMode(false);
  }, []);

  return {
    editMode,
    startEditing,
    stopEditing,
  };
}
