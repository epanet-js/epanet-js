import { useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { dialogAtom, dataAtom } from "src/state/jotai";
import { useUserTracking } from "src/infra/user-tracking";

export const useImportCustomerPoints = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const data = useAtomValue(dataAtom);
  const userTracking = useUserTracking();

  const importCustomerPoints = useCallback(
    ({ source }: { source: string }) => {
      userTracking.capture({
        name: "importCustomerPoints.started",
        source,
      });

      const hasExistingCustomerPoints =
        data.hydraulicModel.customerPoints.size > 0;

      if (hasExistingCustomerPoints) {
        setDialogState({
          type: "importCustomerPointsWarning",
          onContinue: () => {
            setDialogState({
              type: "importCustomerPointsWizard",
            });
          },
        });
      } else {
        setDialogState({
          type: "importCustomerPointsWizard",
        });
      }
    },
    [setDialogState, userTracking, data.hydraulicModel.customerPoints.size],
  );

  return importCustomerPoints;
};
