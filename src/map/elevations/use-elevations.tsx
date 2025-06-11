import { Unit } from "src/quantity";
import { LngLat } from "mapbox-gl";
import { isFeatureOn } from "src/infra/feature-flags";
import {
  fallbackElevation,
  fetchElevationForPoint,
  fetchElevationForPointDeprecated,
  prefetchElevationsTile,
  prefetchElevationsTileDeprecated,
} from "./elevations";
import { captureError } from "src/infra/error-tracking";
import { notify } from "src/components/notifications";
import { ValueNoneIcon } from "@radix-ui/react-icons";
import { translate } from "src/infra/i18n";
import { offlineAtom } from "src/state/offline";
import { useCallback } from "react";
import { useAtomValue } from "jotai";

export const useElevations = (unit: Unit) => {
  const isOffline = useAtomValue(offlineAtom);
  const prefetchTile = useCallback(
    (lngLat: LngLat) => {
      if (isOffline) return;

      isFeatureOn("FLAG_OFFLINE_ERROR")
        ? void prefetchElevationsTile(lngLat)
        : void prefetchElevationsTileDeprecated(lngLat).catch((e) =>
            captureError(e),
          );
    },
    [isOffline],
  );

  const fetchElevation = useCallback(
    async (lngLat: LngLat) => {
      let elevation;

      if (isFeatureOn("FLAG_OFFLINE_ERROR")) {
        if (isOffline) {
          notifyOfflineElevation();
          return fallbackElevation;
        }

        try {
          elevation = await fetchElevationForPoint(lngLat, {
            unit,
          });
        } catch (error) {
          if ((error as Error).message.includes("Failed to fetch")) {
            notifyOfflineElevation();
          }
          if ((error as Error).message.includes("Tile not found")) {
            notifyTileNotAvailable();
          }
          elevation = fallbackElevation;
        }
      } else {
        elevation = await fetchElevationForPointDeprecated(lngLat, {
          unit,
        });
      }
      return elevation;
    },
    [isOffline, unit],
  );

  return { fetchElevation, prefetchTile };
};

const notifyOfflineElevation = () => {
  notify({
    variant: "warning",
    Icon: ValueNoneIcon,
    title: translate("failedToFetchElevation"),
    description: translate("failedToFetchElevationExplain"),
    id: "elevations-failed-to-fetch",
  });
};

const notifyTileNotAvailable = () => {
  notify({
    variant: "warning",
    Icon: ValueNoneIcon,
    title: translate("elevationNotAvailable"),
    description: translate("elevationNotAvailableExplain"),
    id: "elevations-not-found",
  });
};
