import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/jotai";

export const useImportCustomerPoints = () => {
  const setDialogState = useSetAtom(dialogAtom);

  const importCustomerPoints = useCallback(
    ({ source: _source }: { source: string }) => {
      // Open the wizard dialog instead of doing direct import
      setDialogState({
        type: "importCustomerPointsWizard",
      });
    },
    [setDialogState],
  );

  return importCustomerPoints;
};
