import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { selectionAtom } from "src/state/selection";
import type { CustomerPointId } from "src/hydraulic-model/customer-points";

export const useSelectCustomerPointInApp = () => {
  const setSelection = useSetAtom(selectionAtom);
  return useCallback(
    (id: CustomerPointId) => {
      setSelection({ type: "singleCustomerPoint", id });
    },
    [setSelection],
  );
};
