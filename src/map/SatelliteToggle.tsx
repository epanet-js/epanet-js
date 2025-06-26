import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useToggleSatellite } from "src/commands/toggle-satellite";
import { useUserTracking } from "src/infra/user-tracking";
import LAYERS from "src/lib/default-layers";
import { mapboxStaticURL } from "src/lib/mapbox-static-url";
import { layerConfigAtom } from "src/state/jotai";
import { offlineAtom } from "src/state/offline";

export const SatelliteToggle = () => {
  const toggleSatellite = useToggleSatellite();
  const layerConfigs = useAtomValue(layerConfigAtom);
  const userTracking = useUserTracking();
  const isOffline = useAtomValue(offlineAtom);

  const buttonBackgroundImage = useMemo(() => {
    if (isOffline || layerConfigs.size !== 1) return null;

    const currentBaseMap = [...layerConfigs.values()][0];
    if (currentBaseMap.name === "Monochrome") {
      return mapboxStaticURL(LAYERS.SATELLITE);
    }
    if (currentBaseMap.name === "Satellite") {
      return mapboxStaticURL(LAYERS.MONOCHROME);
    }

    return null;
  }, [layerConfigs, isOffline]);

  if (!buttonBackgroundImage) return null;

  return (
    <div
      className="absolute bottom-[48px] left-3 w-16 h-16 sm:w-24 sm:h-24 mb-2 bg-white rounded border border-white border-2 shadow-md cursor-pointer"
      style={{
        backgroundSize: "cover",
        backgroundImage: `url(${buttonBackgroundImage})`,
      }}
      onClick={() => {
        userTracking.capture({
          name: "satelliteView.toggled",
          source: "button",
        });
        toggleSatellite();
      }}
    ></div>
  );
};
