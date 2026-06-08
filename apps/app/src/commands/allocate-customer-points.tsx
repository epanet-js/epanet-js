import { useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useImportCustomerPoints } from "./import-customer-points";

export const useAllocateCustomerPoints = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const importCustomerPoints = useImportCustomerPoints();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);

  const allocateCustomerPoints = useCallback(() => {
    if (hydraulicModel.customerPoints.size === 0) {
      setDialogState({
        type: "allocateCustomerPointsWarning",
        onImport: () => {
          importCustomerPoints({ source: "allocate" });
        },
      });
    } else {
      setDialogState({ type: "allocateCustomerPoints" });
    }
  }, [
    hydraulicModel.customerPoints.size,
    setDialogState,
    importCustomerPoints,
  ]);

  return allocateCustomerPoints;
};
