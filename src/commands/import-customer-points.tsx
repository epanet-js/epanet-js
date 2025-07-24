import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/jotai";
import { useUserTracking } from "src/infra/user-tracking";

export const useImportCustomerPoints = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const importCustomerPoints = useCallback(
    ({ source }: { source: string }) => {
      userTracking.capture({
        name: "importCustomerPoints.started",
        source,
      });

      setDialogState({
        type: "importCustomerPointsWizard",
      });
    },
    [setDialogState, userTracking],
  );

  return importCustomerPoints;
};
