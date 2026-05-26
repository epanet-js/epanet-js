import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";

export const useShowPriorityAccessDialog = () => {
  const setDialog = useSetAtom(dialogAtom);
  return useCallback(
    ({ featureName }: { featureName: string }) => {
      setDialog({ type: "priorityAccess", featureName });
    },
    [setDialog],
  );
};
