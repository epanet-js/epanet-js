import { useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useOpenCustomerPointsImport } from "./open-customer-points-import";

export const useAllocateCustomerPoints = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const openCustomerPointsImport = useOpenCustomerPointsImport();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);

  const allocateCustomerPoints = useCallback(() => {
    if (hydraulicModel.customerPoints.size === 0) {
      setDialogState({
        type: "allocateCustomerPointsWarning",
        onImport: () => {
          openCustomerPointsImport({ source: "allocate" });
        },
      });
    } else {
      setDialogState({ type: "allocateCustomerPoints" });
    }
  }, [
    hydraulicModel.customerPoints.size,
    setDialogState,
    openCustomerPointsImport,
  ]);

  return allocateCustomerPoints;
};
