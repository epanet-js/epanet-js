import { useCallback, useEffect, useState } from "react";
import { CellPosition, EditMode } from "../types";

type UseMouseSelectionOptions = {
  editMode: EditMode;
  setActiveCell: (cell: CellPosition, extend?: boolean) => void;
};

export function useMouseSelection({
  editMode,
  setActiveCell,
}: UseMouseSelectionOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const startDrag = useCallback(() => setIsDragging(true), []);
  const stopDrag = useCallback(() => setIsDragging(false), []);

  const handleCellMouseDown = useCallback(
    (col: number, row: number, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setActiveCell({ col, row }, e.shiftKey);
      if (!e.shiftKey && editMode !== "full") {
        startDrag();
      }
    },
    [setActiveCell, startDrag, editMode],
  );

  const handleCellMouseEnter = useCallback(
    (col: number, row: number) => {
      if (isDragging) {
        setActiveCell({ col, row }, true);
      }
    },
    [isDragging, setActiveCell],
  );

  useEffect(
    function stopDragOnMouseUp() {
      if (!isDragging) return;

      const handleMouseUp = () => stopDrag();
      document.addEventListener("mouseup", handleMouseUp);
      return () => document.removeEventListener("mouseup", handleMouseUp);
    },
    [isDragging, stopDrag],
  );

  return {
    isDragging,
    handleCellMouseDown,
    handleCellMouseEnter,
  };
}
