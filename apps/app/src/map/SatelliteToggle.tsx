import { useAtomValue } from "jotai";
import { useMemo } from "react";
import clsx from "clsx";
import { useToggleSatellite } from "src/commands/toggle-satellite";
import { useUserTracking } from "src/infra/user-tracking";
import { basemaps } from "src/map/basemaps";
import { layerConfigAtom } from "src/state/map";
import { showGridAtom } from "src/state/map-projection";
import { offlineAtom } from "src/state/offline";
import { isPlayingAtom } from "src/state/simulation-playback";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { mapOverlayShadow } from "src/components/map-overlay";

export const SatelliteToggle = () => {
  const toggleSatellite = useToggleSatellite();
  const layerConfigs = useAtomValue(layerConfigAtom);
  const userTracking = useUserTracking();
  const isOffline = useAtomValue(offlineAtom);
  const isGridOn = useAtomValue(showGridAtom);
  const isPlaying = useAtomValue(isPlayingAtom);
  const isDrawingToolbar = useFeatureFlag("FLAG_DRAWING_TOOLBAR");

  const buttonThumbnailClass = useMemo(() => {
    if (isOffline || layerConfigs.size !== 1) return null;

    const currentBaseMap = [...layerConfigs.values()][0];
    if (currentBaseMap.name === "Monochrome") {
      return basemaps.satellite.thumbnailClass;
    }
    if (currentBaseMap.name === "Satellite") {
      return basemaps.monochrome.thumbnailClass;
    }

    return null;
  }, [layerConfigs, isOffline]);

  if (isGridOn || !buttonThumbnailClass || isPlaying) return null;

  return (
    <div
      className={clsx(
        "absolute bottom-8 w-16 h-16 sm:w-16 sm:h-16",
        isDrawingToolbar ? "left-2" : "left-3",
        "bg-white rounded-sm border-white border-2 cursor-pointer",
        isDrawingToolbar ? mapOverlayShadow : "shadow-md",
        buttonThumbnailClass,
      )}
      onClick={() => {
        userTracking.capture({
          name: "satelliteView.toggled",
          source: "button",
        });
        toggleSatellite();
      }}
    />
  );
};
