import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { bottomSidebarOpenAtom } from "src/state/layout";

export const toggleBottomSidebarShortcut = "ctrl+j";

export const useToggleBottomSidebar = () => {
  const setOpen = useSetAtom(bottomSidebarOpenAtom);

  return useCallback(() => {
    setOpen((v) => !v);
  }, [setOpen]);
};
