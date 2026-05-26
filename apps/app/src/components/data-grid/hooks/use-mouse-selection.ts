import { useCallback, useEffect, useState } from "react";
import { EditMode } from "../types";

type UseMouseSelectionOptions = {
  editMode: EditMode;
  selectCells: (options?: {
    colIndex?: number;
    rowIndex?: number;
    extend?: boolean;
  }) => void;
};

export function useMouseSelection({
  editMode,
  selectCells,
}: UseMouseSelectionOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const startDrag = useCallback(() => setIsDragging(true), []);
  const stopDrag = useCallback(() => setIsDragging(false), []);

  const handleCellMouseDown = useCallback(
    (col: number, row: number, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      selectCells({ colIndex: col, rowIndex: row, extend: e.shiftKey });
      if (!e.shiftKey && editMode !== "full") {
        startDrag();
      }
    },
    [selectCells, startDrag, editMode],
  );

  const handleCellMouseEnter = useCallback(
    (col: number, row: number) => {
      if (isDragging) {
        selectCells({ colIndex: col, rowIndex: row, extend: true });
      }
    },
    [isDragging, selectCells],
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
