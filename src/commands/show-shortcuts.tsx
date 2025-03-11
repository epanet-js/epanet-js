import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog_state";

export const showSortcutsShortcut = "?";

export const useShowShortcuts = () => {
  const setDialogState = useSetAtom(dialogAtom);

  const showShortcuts = useCallback(() => {
    setDialogState({ type: "cheatsheet" });
  }, [setDialogState]);

  return showShortcuts;
};
