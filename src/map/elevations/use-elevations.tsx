import { Unit } from "src/quantity";
import { LngLat } from "mapbox-gl";
import {
  fallbackElevation,
  fetchElevationForPoint,
  prefetchElevationsTile,
} from "./elevations";
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

      void prefetchElevationsTile(lngLat);
    },
    [isOffline],
  );

  const fetchElevation = useCallback(
    async (lngLat: LngLat) => {
      if (isOffline) {
        notifyOfflineElevation();
        return fallbackElevation;
      }

      let elevation;

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
