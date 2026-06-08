import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";

export const useAllocateCustomerPoints = () => {
  const setDialogState = useSetAtom(dialogAtom);

  const allocateCustomerPoints = useCallback(() => {
    setDialogState({ type: "allocateCustomerPoints" });
  }, [setDialogState]);

  return allocateCustomerPoints;
};
