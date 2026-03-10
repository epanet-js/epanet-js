import type { HandlerContext } from "src/types";
import { modeAtom, Mode, ephemeralStateAtom } from "src/state/jotai";
import noop from "lodash/noop";
import { useSetAtom, useAtomValue } from "jotai";
import { getMapCoord } from "../utils";
import { addCustomerPoint } from "src/hydraulic-model/model-operations";
import { useUserTracking } from "src/infra/user-tracking";
import { useSelection } from "src/selection";
import { selectionAtom, modelFactoriesAtom } from "src/state/jotai";

export function useDrawCustomerPointHandlers({
  hydraulicModel,
  rep,
  readonly = false,
}: HandlerContext): Handlers {
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const selection = useAtomValue(selectionAtom);
  const { customerPointFactory } = useAtomValue(modelFactoriesAtom);
  const transact = rep.useTransact();
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
