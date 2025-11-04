import { useAtomValue } from "jotai";
import { useMemo } from "react";
import clsx from "clsx";
import { useToggleSatellite } from "src/commands/toggle-satellite";
import { useUserTracking } from "src/infra/user-tracking";
import { basemaps } from "src/map/basemaps";
import { layerConfigAtom } from "src/state/jotai";
import { offlineAtom } from "src/state/offline";

export const SatelliteToggle = () => {
  const toggleSatellite = useToggleSatellite();
  const layerConfigs = useAtomValue(layerConfigAtom);
  const userTracking = useUserTracking();
  const isOffline = useAtomValue(offlineAtom);

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

  if (!buttonThumbnailClass) return null;

  return (
    <div
      className={clsx(
        "absolute bottom-[2rem] left-3 w-16 h-16 sm:w-16 sm:h-16",
        "bg-white rounded border-white border-2 shadow-md cursor-pointer",
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
