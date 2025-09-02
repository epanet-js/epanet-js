import { Unit } from "src/quantity";
import { LngLat } from "mapbox-gl";
import {
  fallbackElevation,
  fetchElevationForPoint,
  prefetchElevationsTile,
} from "./elevations";
import { notify } from "src/components/notifications";
import { ValueNoneIcon } from "@radix-ui/react-icons";
import { useTranslate } from "src/hooks/use-translate";
import { offlineAtom } from "src/state/offline";
import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { UnavailableIcon } from "src/icons";

export const useElevations = (unit: Unit) => {
  const translate = useTranslate();
  const isOffline = useAtomValue(offlineAtom);
  const isLucideIconsOn = useFeatureFlag("lucidIcons");
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
        notifyOfflineElevation(translate, isLucideIconsOn);
        return fallbackElevation;
      }

      let elevation;

      try {
        elevation = await fetchElevationForPoint(lngLat, {
          unit,
        });
      } catch (error) {
        if ((error as Error).message.includes("Failed to fetch")) {
          notifyOfflineElevation(translate, isLucideIconsOn);
        }
        if ((error as Error).message.includes("Tile not found")) {
          notifyTileNotAvailable(translate, isLucideIconsOn);
        }
        elevation = fallbackElevation;
      }
      return elevation;
    },
    [isOffline, unit, translate, isLucideIconsOn],
  );

  return { fetchElevation, prefetchTile };
};

const notifyOfflineElevation = (
  translate: ReturnType<typeof useTranslate>,
  isLucideIconsOn: boolean,
) => {
  notify({
    variant: "warning",
    Icon: isLucideIconsOn ? UnavailableIcon : ValueNoneIcon,
    title: translate("failedToFetchElevation"),
    description: translate("failedToFetchElevationExplain"),
    id: "elevations-failed-to-fetch",
    isLucideIconsOn: isLucideIconsOn,
  });
};

const notifyTileNotAvailable = (
  translate: ReturnType<typeof useTranslate>,
  isLucideIconsOn: boolean,
) => {
  notify({
    variant: "warning",
    Icon: isLucideIconsOn ? UnavailableIcon : ValueNoneIcon,
    title: translate("elevationNotAvailable"),
    description: translate("elevationNotAvailableExplain"),
    id: "elevations-not-found",
    isLucideIconsOn: isLucideIconsOn,
  });
};
