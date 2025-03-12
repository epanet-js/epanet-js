import { useAtomValue } from "jotai";
import { useCallback } from "react";
import LAYERS from "src/lib/default_layers";
import { newFeatureId } from "src/lib/id";
import { useLayerConfigState } from "src/map/layer-config";
import { layerConfigAtom } from "src/state/jotai";
import { useHotkeys } from "src/keyboard/hotkeys";
import { useUserTracking } from "src/infra/user-tracking";

export const useToggleSatellite = () => {
  const layerConfigs = useAtomValue(layerConfigAtom);
  const { applyChanges } = useLayerConfigState();
  const userTracking = useUserTracking();

  const toggleSatellite = useCallback(() => {
    const currentBaseMap = [...layerConfigs.values()][0];
    const newBaseMap =
      currentBaseMap.name === LAYERS.MONOCHROME.name
        ? LAYERS.SATELLITE
        : LAYERS.MONOCHROME;
    applyChanges({
      deleteLayerConfigs: [currentBaseMap.id],
      putLayerConfigs: [
        {
          ...newBaseMap,
          visibility: true,
          tms: false,
          opacity: newBaseMap.opacity,
          at: currentBaseMap.at,
          id: newFeatureId(),
          labelVisibility: true,
        },
      ],
    });
  }, [layerConfigs, applyChanges]);

  useHotkeys(
    "b",
    (e) => {
      e.preventDefault();
      userTracking.capture({
        name: "satelliteView.toggled",
        source: "shortcut",
      });
      toggleSatellite();
    },
    [toggleSatellite],
    `Toggle satellite`,
  );

  return toggleSatellite;
};
