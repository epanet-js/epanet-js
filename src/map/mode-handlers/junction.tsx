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
import {
  fetchElevationForPointDeprecated,
  prefetchElevationsTileDeprecated,
} from "../elevations";
import throttle from "lodash/throttle";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
import { isFeatureOn } from "src/infra/feature-flags";
import {
  fetchElevationForPoint,
  prefetchElevationsTile,
  fallbackElevation,
} from "../elevations/elevations";
import { LinkBreak1Icon } from "@radix-ui/react-icons";
import { notify } from "src/components/notifications";

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
      let elevation;

      if (isFeatureOn("FLAG_OFFLINE_ERROR")) {
        try {
          elevation = await fetchElevationForPoint(e.lngLat, {
            unit: units.elevation,
          });
        } catch (error) {
          if ((error as Error).message.includes("Failed to fetch")) {
            notify.error({
              Icon: LinkBreak1Icon,
              title: "No Internet Connection",
              description:
                "Elevation data cannot be retrieved, so 0 will be assigned.",
              id: "elevation-fetch-error",
            });
          }
          if ((error as Error).message.includes("Tile not found")) {
            notify.warning({
              Icon: LinkBreak1Icon,
              title: "Elevation Not Avaiable",
              description:
                "It wasn't possible to retrieve the elevation for this point. Using 0 instead.",
              id: "tile-not-found",
            });
          }
          elevation = fallbackElevation;
          return;
        }
      } else {
        elevation = await fetchElevationForPointDeprecated(e.lngLat, {
          unit: units.elevation,
        });
      }
      const junction = assetBuilder.buildJunction({
        elevation,
        coordinates: clickPosition,
      });

      const id = junction.id;

      const moment = addJunction(hydraulicModel, { junction });
      transact(moment);
      userTracking.capture({ name: "asset.created", type: "junction" });
      if (!multi) {
        setSelection(USelection.single(id));
      }
    },
    move: throttle((e) => {
      isFeatureOn("FLAG_OFFLINE_ERROR")
        ? void prefetchElevationsTile(e.lngLat)
        : void prefetchElevationsTileDeprecated(e.lngLat).catch((e) =>
            captureError(e),
          );
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
