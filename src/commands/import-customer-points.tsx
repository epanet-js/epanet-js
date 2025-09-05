import { useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { dialogAtom, dataAtom } from "src/state/jotai";
import { useUserTracking } from "src/infra/user-tracking";
import { useEarlyAccess } from "src/hooks/use-early-access";

export const useImportCustomerPoints = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const data = useAtomValue(dataAtom);
  const userTracking = useUserTracking();
  const onlyEarlyAccess = useEarlyAccess();

  const importCustomerPoints = useCallback(
    ({ source }: { source: string }) => {
      onlyEarlyAccess(() => {
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
      }, "importCustomerPointsWizard");
    },
    [
      setDialogState,
      userTracking,
      data.hydraulicModel.customerPoints.size,
      onlyEarlyAccess,
    ],
  );

  return importCustomerPoints;
};
