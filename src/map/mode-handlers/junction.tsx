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
import toast from "react-hot-toast";
import { LinkBreak1Icon } from "@radix-ui/react-icons";

const NoInternetAlert = () => (
  <div className="flex items-start p-4 bg-red-50 border border-red-200 rounded-lg shadow-md">
    <LinkBreak1Icon className="h-8 w-8 text-red-500 mr-3" aria-hidden="true" />

    <div className="flex flex-col">
      <span className="text-base font-semibold text-red-700">
        No internet connection
      </span>
      <span className="text-sm text-red-600 mt-1">
        Elevation data cannot be retrieved, so 0 will be assigned for this node.
      </span>
    </div>
  </div>
);

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
          toast.custom(() => <NoInternetAlert />, { duration: 5000 });
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
