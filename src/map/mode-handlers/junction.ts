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
import { addJunction } from "src/hydraulic-model/model-operations";
import { fetchElevationForPoint, prefetchElevationsTile } from "../elevations";
import throttle from "lodash/throttle";
import { captureError } from "src/infra/error-tracking";
import { isFeatureOn } from "src/infra/feature-flags";
import { useUserTracking } from "src/infra/user-tracking";

export function useJunctionHandlers({
  mode,
  hydraulicModel,
  rep,
}: HandlerContext): Handlers {
  const setSelection = useSetAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const multi = mode.modeOptions?.multi;
  const { assetBuilder, units } = hydraulicModel;

  return {
    click: async (e) => {
      if (!multi) {
        setMode({ mode: Mode.NONE });
      }

      const clickPosition = getMapCoord(e);
      const elevation = await fetchElevationForPoint(e.lngLat, {
        unit: units.elevation,
      });
      const junction = assetBuilder.buildJunction({
        elevation,
        coordinates: clickPosition,
      });

      const id = junction.id;

      const moment = addJunction(hydraulicModel, { junction });
      transact(moment);
      if (isFeatureOn("FLAG_TRACKING"))
        userTracking.capture({ name: "asset.created", type: "junction" });
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
