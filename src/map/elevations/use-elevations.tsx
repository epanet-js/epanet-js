import { Unit } from "src/quantity";
import { LngLat } from "mapbox-gl";
import { prefetchElevationsTile } from "src/lib/elevations";
import { notify } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { offlineAtom } from "src/state/offline";
import { autoElevationsAtom } from "src/state/drawing";
import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { UnavailableIcon } from "src/icons";
import { elevationSourcesAtom } from "src/state/elevation-sources";
import { fetchElevationFromSources } from "src/lib/elevations";

const fallbackElevation = 0;

export const useElevations = (unit: Unit) => {
  const translate = useTranslate();
  const isOffline = useAtomValue(offlineAtom);
  const autoElevations = useAtomValue(autoElevationsAtom);
  const sources = useAtomValue(elevationSourcesAtom);

  const prefetchTile = useCallback(
    (lngLat: LngLat) => {
      if (!autoElevations || isOffline) return;

      for (const source of sources) {
        if (source.type !== "tile-server" || !source.enabled) continue;
        void prefetchElevationsTile(lngLat, source);
      }
    },
    [autoElevations, isOffline, sources],
  );

  const fetchElevation = useCallback(
    async (lngLat: LngLat) => {
      if (!autoElevations) return fallbackElevation;

      try {
        const availableSources = isOffline
          ? sources.filter((s) => s.type !== "tile-server")
          : sources;
        const elevation = await fetchElevationFromSources(
          availableSources,
          lngLat.lng,
          lngLat.lat,
          unit,
        );
        if (isOffline && elevation === null) {
          notifyOfflineElevation(translate);
        }
        return elevation ?? fallbackElevation;
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
    [autoElevations, isOffline, sources, unit, translate],
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
