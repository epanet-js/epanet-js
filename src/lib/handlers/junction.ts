import { USelection } from "src/state";
import type { HandlerContext, Point } from "src/types";
import { modeAtom, Mode, selectionAtom, cursorStyleAtom } from "src/state/jotai";
import noop from "lodash/noop";
import { useSetAtom } from "jotai";
import { CURSOR_DEFAULT } from "src/lib/constants";
import { createOrUpdateFeature, getMapCoord } from "./utils";
import {trackUserAction} from "src/infra/user-tracking";
import {captureError} from "src/infra/error-tracking";

export function useJunctionHandlers({
  dragTargetRef,
  mode,
  selection,
  featureMap,
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

      const point: Point = {
        type: "Point",
        coordinates: getMapCoord(e),
      };

      const putFeature = createOrUpdateFeature({
        mode,
        selection,
        featureMap,
        geometry: point,
      });

      const id = putFeature.id;

      trackUserAction('JUNCTION_ADDED')
      transact({
        note: "Draw junction",
        putFeatures: [putFeature],
      })
        .then(() => {
          if (!multi) {
            setSelection(USelection.single(id));
          }
        })
        .catch((e) => captureError(e));
    },
    move: noop,
    down: noop,
    up() {
      dragTargetRef.current = null;
      setCursor(CURSOR_DEFAULT);
    },
    double: noop,
    enter() {
      setMode({ mode: Mode.NONE });
    },
  };
}
