import type { HandlerContext } from "src/types";
import type { CustomerPointId } from "@epanet-js/hydraulic-model";
import { ephemeralStateAtom } from "src/state/drawing";
import { modeAtom, Mode } from "src/state/mode";
import noop from "lodash/noop";
import { useSetAtom, useAtomValue } from "jotai";
import { getMapCoord } from "../utils";
import { addCustomerPoint } from "src/hydraulic-model/model-operations";
import { useUserTracking } from "src/infra/user-tracking";
import { useSelection } from "src/selection";
import { modelFactoriesAtom } from "src/state/model-factories";
import { selectionAtom } from "src/state/selection";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import type { ChangeSet } from "@epanet-js/change-set";

const createdCustomerPointId = (
  changeSet: ChangeSet,
): CustomerPointId | undefined => {
  for (const entry of changeSet.entries()) {
    if (entry.entity === "customerPoint" && entry.kind === "create") {
      return entry.id as CustomerPointId;
    }
  }
  return undefined;
};

export function useDrawCustomerPointHandlers({
  hydraulicModel,
  readonly = false,
}: HandlerContext): Handlers {
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const selection = useAtomValue(selectionAtom);
  const { customerPointFactory } = useAtomValue(modelFactoriesAtom);
  const { transact } = useModelTransaction();
  const userTracking = useUserTracking();
  const { selectCustomerPoint } = useSelection(selection);

  return {
    click: (e) => {
      if (readonly) return;

      const coordinates = getMapCoord(e);
      const data = { coordinates, customerPointFactory };

      const changeSet = transact(() => addCustomerPoint(hydraulicModel, data));
      const createdId = changeSet
        ? createdCustomerPointId(changeSet)
        : undefined;
      userTracking.capture({ name: "customerPointActions.created" });

      if (createdId !== undefined) {
        selectCustomerPoint(createdId);
      }
    },
    move: noop,
    down: noop,
    up: noop,
    double: noop,
    exit() {
      setMode({ mode: Mode.NONE });
      setEphemeralState({ type: "none" });
    },
  };
}
