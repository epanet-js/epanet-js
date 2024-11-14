import { USelection } from "src/selection";
import type { HandlerContext } from "src/types";
import {
  modeAtom,
  Mode,
  selectionAtom,
  cursorStyleAtom,
} from "src/state/jotai";
import noop from "lodash/noop";
import { useSetAtom } from "jotai";
import { CURSOR_DEFAULT } from "src/lib/constants";
import { getMapCoord } from "./utils";
import { captureError } from "src/infra/error-tracking";
import { addJunction } from "src/hydraulics/model-operations";
import { createJunction } from "src/hydraulics/assets";
import { isFeatureOn } from "src/infra/feature-flags";

export function useJunctionHandlers({
  mode,
  hydraulicModel,
  rep,
}: HandlerContext): Handlers {
  const setSelection = useSetAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const multi = mode.modeOptions?.multi;
  return {
    click: (e) => {
      if (!multi) {
        setMode({ mode: Mode.NONE });
      }

      const clickPosition = getMapCoord(e);
      const junction = createJunction(clickPosition);

      const id = junction.id;

      const moment = addJunction(hydraulicModel, { junction });
      if (isFeatureOn("FLAG_SPLIT_SOURCES")) {
        transact(moment);
        if (!multi) {
          setSelection(USelection.single(id));
        }
      } else {
        transact(moment)
          .then(() => {
            if (!multi) {
              setSelection(USelection.single(id));
            }
          })
          .catch((e) => captureError(e));
      }
    },
    move: noop,
    down: noop,
    up() {
      setCursor(CURSOR_DEFAULT);
    },
    double: noop,
    exit() {
      setMode({ mode: Mode.NONE });
    },
  };
}
