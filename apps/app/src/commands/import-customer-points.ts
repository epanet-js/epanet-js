import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import type {
  CustomAttributesDefinition,
  CustomerPoint,
  CustomerPointId,
  Demand,
} from "@epanet-js/hydraulic-model";
import { replaceCustomerPoints } from "@epanet-js/hydraulic-model-operations";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { modeAtom, Mode } from "src/state/mode";
import { ephemeralStateAtom } from "src/state/drawing";

type ImportedCustomerPoints = {
  customerPoints: readonly CustomerPoint[];
  customerPointDemands: ReadonlyMap<CustomerPointId, Demand[]>;
  preserveJunctionDemands: boolean;
  customAttributes?: CustomAttributesDefinition;
};

export const useImportCustomerPoints = () => {
  const { transact } = useModelTransaction();

  return useAtomCallback(
    useCallback(
      (get: Getter, set: Setter, data: ImportedCustomerPoints): boolean => {
        const changeSet = transact(() =>
          replaceCustomerPoints(get(stagingModelDerivedAtom), data),
        );
        if (!changeSet) return false;

        set(modeAtom, { mode: Mode.NONE });
        set(ephemeralStateAtom, { type: "none" });
        set(selectionAtom, USelection.none());
        return true;
      },
      [transact],
    ),
  );
};
