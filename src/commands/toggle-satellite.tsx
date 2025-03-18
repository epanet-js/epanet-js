import { useAtomValue } from "jotai";
import { useCallback } from "react";
import LAYERS from "src/lib/default_layers";
import { newFeatureId } from "src/lib/id";
import { useLayerConfigState } from "src/map/layer-config";
import { layerConfigAtom } from "src/state/jotai";
import { useHotkeys } from "src/keyboard/hotkeys";
import { useUserTracking } from "src/infra/user-tracking";
import { isFeatureOn } from "src/infra/feature-flags";
import { useAuth } from "src/auth";
import { ILayerConfig } from "src/types";

const satelliteLimitedZoom = 16;

export const useToggleSatellite = () => {
  const layerConfigs = useAtomValue(layerConfigAtom);
  const { applyChanges } = useLayerConfigState();
  const userTracking = useUserTracking();
  const { isSignedIn } = useAuth();

  const toggleSatellite = useCallback(() => {
    const currentBaseMap = [...layerConfigs.values()][0];
    const newBaseMap =
      currentBaseMap.name === LAYERS.MONOCHROME.name
        ? LAYERS.SATELLITE
        : LAYERS.MONOCHROME;

    const newLayerConfig: ILayerConfig = {
      ...newBaseMap,
      visibility: true,
      tms: false,
      opacity: newBaseMap.opacity,
      at: currentBaseMap.at,
      id: newFeatureId(),
      labelVisibility: true,
      sourceMaxZoom: {},
    };

    if (
      isFeatureOn("FLAG_LIMIT_RESOLUTION") &&
      !isSignedIn &&
      newBaseMap.name === LAYERS.SATELLITE.name
    ) {
      newLayerConfig.sourceMaxZoom["mapbox-satellite"] = satelliteLimitedZoom;
    }

    applyChanges({
      deleteLayerConfigs: [currentBaseMap.id],
      putLayerConfigs: [newLayerConfig],
    });
  }, [layerConfigs, applyChanges, isSignedIn]);

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
