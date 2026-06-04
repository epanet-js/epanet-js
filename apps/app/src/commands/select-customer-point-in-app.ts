import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { type CustomerPointId } from "@epanet-js/hydraulic-model";

export const useSelectCustomerPointInApp = () => {
  const setSelection = useSetAtom(selectionAtom);
  return useCallback(
    (id: CustomerPointId) => {
      setSelection(USelection.singleCustomerPoint(id));
    },
    [setSelection],
  );
};
