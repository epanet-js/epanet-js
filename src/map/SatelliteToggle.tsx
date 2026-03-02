import { useAtomValue } from "jotai";
import { useMemo } from "react";
import clsx from "clsx";
import { useToggleSatellite } from "src/commands/toggle-satellite";
import { useUserTracking } from "src/infra/user-tracking";
import { basemaps } from "src/map/basemaps";
import {
  bottomSidebarMaximizedAtom,
  isUnprojectedAtom,
  layerConfigAtom,
} from "src/state/jotai";
import { offlineAtom } from "src/state/offline";

export const SatelliteToggle = () => {
  const toggleSatellite = useToggleSatellite();
  const layerConfigs = useAtomValue(layerConfigAtom);
  const userTracking = useUserTracking();
  const isOffline = useAtomValue(offlineAtom);
  const isUnprojected = useAtomValue(isUnprojectedAtom);

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

  const bottomSidebarMaximized = useAtomValue(bottomSidebarMaximizedAtom);

  if (isUnprojected || !buttonThumbnailClass || bottomSidebarMaximized)
    return null;

  return (
    <div
      className={clsx(
        "absolute z-[3] w-16 h-16",
        "bg-white rounded border-white border-2 shadow-md cursor-pointer",
        buttonThumbnailClass,
      )}
      style={{
        left: "calc(var(--sidebar-left, 44px) + 12px)",
        bottom: "calc(var(--bottom-sidebar-height, 0px) + 2rem)",
      }}
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
