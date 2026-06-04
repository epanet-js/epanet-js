import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { type CustomerPointId } from "@epanet-js/hydraulic-model";
import { useSelection } from "src/selection";
import { selectionAtom } from "src/state/selection";

export const useSelectCustomerPointsInApp = () => {
  const selection = useAtomValue(selectionAtom);
  const { selectCustomerPoints } = useSelection(selection);

  return useCallback(
    (customerPointIds: CustomerPointId[]) => {
      if (customerPointIds.length === 0) return;
      selectCustomerPoints(customerPointIds);
    },
    [selectCustomerPoints],
  );
};
