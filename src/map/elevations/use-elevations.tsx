import { Unit } from "src/quantity";
import { LngLat } from "mapbox-gl";
import {
  fetchElevationForPoint,
  prefetchElevationsTile,
} from "src/lib/elevations";
import { notify } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { offlineAtom } from "src/state/offline";
import { autoElevationsAtom } from "src/state/drawing";
import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { UnavailableIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { elevationSourcesAtom } from "src/state/elevation-sources";
import { fetchElevationFromSources } from "src/lib/elevations";

const fallbackElevation = 0;

export const useElevations = (unit: Unit) => {
  const translate = useTranslate();
  const isOffline = useAtomValue(offlineAtom);
  const autoElevations = useAtomValue(autoElevationsAtom);
  const isDtmElevationsOn = useFeatureFlag("FLAG_DTM_ELEVATIONS");
  const sources = useAtomValue(elevationSourcesAtom);

  const prefetchTile = useCallback(
    (lngLat: LngLat) => {
      if (!autoElevations || isOffline) return;

      void prefetchElevationsTile(lngLat);
    },
    [autoElevations, isOffline],
  );

  const fetchElevation = useCallback(
    async (lngLat: LngLat) => {
      if (!autoElevations) return fallbackElevation;

      try {
        if (isDtmElevationsOn) {
          const availableSources = isOffline
            ? sources.filter((s) => s.type !== "tile-server")
            : sources;
          const elevation = await fetchElevationFromSources(
            availableSources,
            lngLat.lng,
            lngLat.lat,
            unit,
          );
          return elevation ?? fallbackElevation;
        }

        if (isOffline) {
          notifyOfflineElevation(translate);
          return fallbackElevation;
        }

        return await fetchElevationForPoint(lngLat, { unit });
      } catch (error) {
        if ((error as Error).message.includes("Failed to fetch")) {
          notifyOfflineElevation(translate);
        }
        if ((error as Error).message.includes("Tile not found")) {
          notifyTileNotAvailable(translate);
        }
        return fallbackElevation;
      }
    },
    [autoElevations, isOffline, isDtmElevationsOn, sources, unit, translate],
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
