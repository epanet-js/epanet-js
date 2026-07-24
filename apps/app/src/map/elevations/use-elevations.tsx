import { Unit } from "@epanet-js/quantity";
import { LngLat } from "mapbox-gl";
import { prefetchElevationsTile } from "src/lib/elevations";
import { notify } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { offlineAtom } from "src/state/offline";
import { autoElevationsAtom } from "src/state/drawing";
import { useCallback, useEffect, useMemo } from "react";
import { useAtomValue } from "jotai";
import throttle from "lodash/throttle";
import { UnavailableIcon } from "src/icons";
import { elevationSourcesAtom } from "src/state/elevation-sources";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  fetchElevationFromSources,
  fetchElevationsFromSources,
} from "src/lib/elevations";

const fallbackElevation = 0;

export const useElevations = (unit: Unit) => {
  const translate = useTranslate();
  const isOffline = useAtomValue(offlineAtom);
  const autoElevations = useAtomValue(autoElevationsAtom);
  const sources = useAtomValue(elevationSourcesAtom);
  // When off, unresolved points coalesce to 0 (legacy behavior); when on they
  // stay null so the model can represent "no elevation".
  const nullElevationsEnabled = useFeatureFlag("FLAG_RECOMPUTE_ELEVATIONS");
  const unresolved = nullElevationsEnabled ? null : fallbackElevation;

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

  const prefetchTileThrottled = useMemo(
    () => throttle(prefetchTile, 200, { leading: true, trailing: true }),
    [prefetchTile],
  );
  useEffect(
    () => () => prefetchTileThrottled.cancel(),
    [prefetchTileThrottled],
  );

  const fetchElevation = useCallback(
    async (lngLat: LngLat): Promise<number | null> => {
      if (!autoElevations) return unresolved;

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
        return elevation ?? unresolved;
      } catch (error) {
        if ((error as Error).message.includes("Failed to fetch")) {
          notifyOfflineElevation(translate);
        }
        if ((error as Error).message.includes("Tile not found")) {
          notifyTileNotAvailable(translate);
        }
        return unresolved;
      }
    },
    [autoElevations, isOffline, sources, unit, translate, unresolved],
  );

  const fetchElevations = useCallback(
    async (lngLats: LngLat[]): Promise<(number | null)[]> => {
      if (!autoElevations) return lngLats.map(() => unresolved);

      try {
        const availableSources = isOffline
          ? sources.filter((s) => s.type !== "tile-server")
          : sources;
        const elevations = await fetchElevationsFromSources(
          availableSources,
          lngLats.map((l) => ({ lng: l.lng, lat: l.lat })),
          unit,
        );
        if (isOffline && elevations.some((e) => e === null)) {
          notifyOfflineElevation(translate);
        }
        return elevations.map((e) => e ?? unresolved);
      } catch (error) {
        if ((error as Error).message.includes("Failed to fetch")) {
          notifyOfflineElevation(translate);
        }
        if ((error as Error).message.includes("Tile not found")) {
          notifyTileNotAvailable(translate);
        }
        return lngLats.map(() => unresolved);
      }
    },
    [autoElevations, isOffline, sources, unit, translate, unresolved],
  );

  return { fetchElevation, fetchElevations, prefetchTileThrottled };
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
