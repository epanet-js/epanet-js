import type { HandlerContext } from "src/types";
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
      const moment = addCustomerPoint(hydraulicModel, {
        coordinates,
        customerPointFactory,
      });
      transact(moment);
      userTracking.capture({ name: "customerPointActions.created" });

      if (moment.putCustomerPoints && moment.putCustomerPoints.length > 0) {
        selectCustomerPoint(moment.putCustomerPoints[0].id);
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
