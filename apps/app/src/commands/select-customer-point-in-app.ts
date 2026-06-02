import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { selectionAtom } from "src/state/selection";
import { type CustomerPointId } from "@epanet-js/hydraulic-model";

export const useSelectCustomerPointInApp = () => {
  const setSelection = useSetAtom(selectionAtom);
  return useCallback(
    (id: CustomerPointId) => {
      setSelection({ type: "singleCustomerPoint", id });
    },
    [setSelection],
  );
};
