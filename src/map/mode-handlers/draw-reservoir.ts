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
import { fetchElevationForPoint, prefetchElevationsTile } from "../elevations";
import throttle from "lodash/throttle";
import { captureError } from "src/infra/error-tracking";
import { addReservoir } from "src/hydraulics/model-operations";

export function useDrawReservoirHandlers({
  mode,
  hydraulicModel,
  rep,
}: HandlerContext): Handlers {
  const setSelection = useSetAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const multi = mode.modeOptions?.multi;
  const { assetBuilder } = hydraulicModel;

  return {
    click: async (e) => {
      if (!multi) {
        setMode({ mode: Mode.NONE });
      }

      const clickPosition = getMapCoord(e);
      const elevation = await fetchElevationForPoint(e.lngLat);
      const reservoir = assetBuilder.buildReservoir({
        elevation,
        coordinates: clickPosition,
      });

      const id = reservoir.id;

      const moment = addReservoir(hydraulicModel, { reservoir });
      transact(moment);
      if (!multi) {
        setSelection(USelection.single(id));
      }
    },
    move: throttle((e) => {
      prefetchElevationsTile(e.lngLat).catch((e) => captureError(e));
    }, 200),
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
