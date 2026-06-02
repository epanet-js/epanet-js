import { useCallback, useState } from "react";
import { GridContextMenuTarget } from "../shared/grid-context-menus";

type Options = {
  onCellContextMenu?: (col: number, row: number, e: React.MouseEvent) => void;
  onGutterContextMenu?: (row: number, e: React.MouseEvent) => void;
};

export function useContextMenuTarget({
  onCellContextMenu,
  onGutterContextMenu,
}: Options) {
  const [menuTarget, setMenuTarget] = useState<GridContextMenuTarget | null>(
    null,
  );

  const clearMenuTarget = useCallback(() => setMenuTarget(null), []);

  const handleCellContextMenu = onCellContextMenu
    ? (col: number, row: number, e: React.MouseEvent) => {
        setMenuTarget({ type: "cell", rowIndex: row, colIndex: col });
        onCellContextMenu(col, row, e);
      }
    : undefined;

  const handleGutterContextMenu = onGutterContextMenu
    ? (row: number, e: React.MouseEvent) => {
        setMenuTarget({ type: "gutter", rowIndex: row });
        onGutterContextMenu(row, e);
      }
    : undefined;

  return {
    menuTarget,
    clearMenuTarget,
    wrappedCellContextMenu: handleCellContextMenu,
    wrappedGutterContextMenu: handleGutterContextMenu,
  };
}
