import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import { removeCustomerPoints } from "src/hydraulic-model/model-operations";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { type CustomerPointId } from "@epanet-js/hydraulic-model";

export const useDeleteCustomerPoints = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const { transact } = useModelTransaction();
  const userTracking = useUserTracking();

  return useCallback(
    (customerPointIds: CustomerPointId[], source: string) => {
      if (customerPointIds.length === 0) return;

      userTracking.capture({
        name: "customerPointActions.removed",
        count: customerPointIds.length,
        source,
      });

      if (
        selection.type === "singleCustomerPoint" &&
        customerPointIds.includes(selection.id)
      ) {
        setSelection(USelection.none());
      }

      const moment = removeCustomerPoints(hydraulicModel, { customerPointIds });
      transact(moment);
    },
    [hydraulicModel, selection, setSelection, transact, userTracking],
  );
};
