import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import {
  removeCustomerPoints,
  removeCustomerPointsDeprecated,
} from "src/hydraulic-model/model-operations";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { type CustomerPointId } from "@epanet-js/hydraulic-model";

export const useDeleteCustomerPoints = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const { transact } = useMomentTransaction();
  const { transact: transactChangeSet } = useModelTransaction();
  const isOpsChangeSetsOn = useFeatureFlag("FLAG_OPS_CHANGE_SETS");
  const userTracking = useUserTracking();

  return useCallback(
    (customerPointIds: CustomerPointId[], source: string) => {
      if (customerPointIds.length === 0) return;

      userTracking.capture({
        name: "customerPointActions.removed",
        count: customerPointIds.length,
        source,
      });

      const selectedCpIds = USelection.getCustomerPointIds(selection);
      const removed = new Set(customerPointIds);
      if (selectedCpIds.some((id) => removed.has(id))) {
        const remainingCps = selectedCpIds.filter((id) => !removed.has(id));
        const assetIds = USelection.getAssetIds(selection).slice();
        setSelection(USelection.fromIds(assetIds, remainingCps));
      }

      if (isOpsChangeSetsOn) {
        transactChangeSet(
          removeCustomerPoints(hydraulicModel, { customerPointIds }),
        );
      } else {
        transact(
          removeCustomerPointsDeprecated(hydraulicModel, { customerPointIds }),
        );
      }
    },
    [
      hydraulicModel,
      selection,
      setSelection,
      isOpsChangeSetsOn,
      transact,
      transactChangeSet,
      userTracking,
    ],
  );
};
