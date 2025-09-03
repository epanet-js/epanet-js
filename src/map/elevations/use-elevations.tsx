import { Unit } from "src/quantity";
import { LngLat } from "mapbox-gl";
import {
  fallbackElevation,
  fetchElevationForPoint,
  prefetchElevationsTile,
} from "./elevations";
import { notify } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { offlineAtom } from "src/state/offline";
import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { UnavailableIcon } from "src/icons";

export const useElevations = (unit: Unit) => {
  const translate = useTranslate();
  const isOffline = useAtomValue(offlineAtom);
  const prefetchTile = useCallback(
    (lngLat: LngLat) => {
      if (isOffline) return;

      void prefetchElevationsTile(lngLat);
    },
    [isOffline],
  );

  const fetchElevation = useCallback(
    async (lngLat: LngLat) => {
      if (isOffline) {
        notifyOfflineElevation(translate);
        return fallbackElevation;
      }

      let elevation;

      try {
        elevation = await fetchElevationForPoint(lngLat, {
          unit,
        });
      } catch (error) {
        if ((error as Error).message.includes("Failed to fetch")) {
          notifyOfflineElevation(translate);
        }
        if ((error as Error).message.includes("Tile not found")) {
          notifyTileNotAvailable(translate);
        }
        elevation = fallbackElevation;
      }
      return elevation;
    },
    [isOffline, unit, translate],
  );

  return { fetchElevation, prefetchTile };
};

const notifyOfflineElevation = (translate: ReturnType<typeof useTranslate>) => {
  notify({
    variant: "warning",
    Icon: UnavailableIcon,
    title: translate("failedToFetchElevation"),
    description: translate("failedToFetchElevationExplain"),
    id: "elevations-failed-to-fetch",
  });
};

const notifyTileNotAvailable = (translate: ReturnType<typeof useTranslate>) => {
  notify({
    variant: "warning",
    Icon: UnavailableIcon,
    title: translate("elevationNotAvailable"),
    description: translate("elevationNotAvailableExplain"),
    id: "elevations-not-found",
  });
};
