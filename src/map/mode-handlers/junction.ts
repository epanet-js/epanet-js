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
import { addJunction } from "src/hydraulics/model-operations";
import { createJunction } from "src/hydraulics/assets";
import { fetchElevationForPoint, prefetchElevationsTile } from "../queries";
import { isFeatureOn } from "src/infra/feature-flags";
import throttle from "lodash/throttle";

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
    click: async (e) => {
      if (!multi) {
        setMode({ mode: Mode.NONE });
      }

      const clickPosition = getMapCoord(e);
      const elevation = isFeatureOn("FLAG_ELEVATIONS")
        ? await fetchElevationForPoint(e.lngLat.lng, e.lngLat.lat)
        : 0;
      const junction = createJunction({
        elevation,
        coordinates: clickPosition,
      });

      const id = junction.id;

      const moment = addJunction(hydraulicModel, { junction });
      transact(moment);
      if (!multi) {
        setSelection(USelection.single(id));
      }
    },
    move: throttle((e) => {
      if (isFeatureOn("FLAG_ELEVATIONS")) {
        prefetchElevationsTile(e.lngLat.lng, e.lngLat.lat);
      }
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
