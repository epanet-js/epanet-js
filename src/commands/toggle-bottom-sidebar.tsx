import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { bottomSidebarOpenAtom } from "src/state/jotai";

export const toggleBottomSidebarShortcut = "ctrl+j";

export const useToggleBottomSidebar = () => {
  const setOpen = useSetAtom(bottomSidebarOpenAtom);

  const toggleBottomSidebar = useCallback(() => {
    setOpen((v) => !v);
  }, [setOpen]);

  return toggleBottomSidebar;
};
