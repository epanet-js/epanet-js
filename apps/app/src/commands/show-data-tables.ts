import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { dialogAtom } from "src/state/dialog";

export const useShowDataTables = () => {
  const setDialogState = useSetAtom(dialogAtom);

  return useCallback(() => {
    setDialogState({ type: "openDataTables" });
  }, [setDialogState]);
};
