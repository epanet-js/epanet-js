import { useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useUserTracking } from "src/infra/user-tracking";
import { useEarlyAccess } from "src/hooks/use-early-access";
import { useImportCustomerPointsDisabled } from "src/hooks/use-import-customer-points-disabled";
import { useTranslate } from "src/hooks/use-translate";
import { notify } from "src/components/notifications";

export const useImportCustomerPoints = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const userTracking = useUserTracking();
  const onlyEarlyAccess = useEarlyAccess();
  const isDisabled = useImportCustomerPointsDisabled();
  const translate = useTranslate();

  const importCustomerPoints = useCallback(
    ({ source }: { source: string }) => {
      onlyEarlyAccess(() => {
        userTracking.capture({
          name: "importCustomerPoints.started",
          source,
        });

        if (isDisabled) {
          notify({
            variant: "error",
            title: translate("importCustomerPoints.blockedByScenarios"),
          });
          return;
        }

        const hasExistingCustomerPoints =
          hydraulicModel.customerPoints.size > 0;

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
      });
    },
    [
      setDialogState,
      userTracking,
      hydraulicModel.customerPoints.size,
      onlyEarlyAccess,
      isDisabled,
      translate,
    ],
  );

  return importCustomerPoints;
};
