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
import throttle from "lodash/throttle";
import { addReservoir } from "src/hydraulic-model/model-operations";
import { useUserTracking } from "src/infra/user-tracking";
import { useElevations } from "../elevations/use-elevations";

export function useDrawReservoirHandlers({
  mode,
  hydraulicModel,
  rep,
}: HandlerContext): Handlers {
  const setSelection = useSetAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const userTracking = useUserTracking();
  const transact = rep.useTransact();
  const multi = mode.modeOptions?.multi;
  const { assetBuilder, units } = hydraulicModel;
  const { fetchElevation, prefetchTile } = useElevations(units.elevation);

  return {
    click: async (e) => {
      if (!multi) {
        setMode({ mode: Mode.NONE });
      }

      const clickPosition = getMapCoord(e);
      const elevation = await fetchElevation(e.lngLat);
      const reservoir = assetBuilder.buildReservoir({
        elevation,
        coordinates: clickPosition,
      });

      const id = reservoir.id;

      const moment = addReservoir(hydraulicModel, { reservoir });
      transact(moment);
      userTracking.capture({ name: "asset.created", type: "reservoir" });
      if (!multi) {
        setSelection(USelection.single(id));
      }
    },
    move: throttle((e) => {
      void prefetchTile(e.lngLat);
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
