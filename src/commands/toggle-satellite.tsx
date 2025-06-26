import { useAtomValue } from "jotai";
import { useCallback } from "react";
import LAYERS from "src/lib/default-layers";
import { newFeatureId } from "src/lib/id";
import { useLayerConfigState } from "src/map/layer-config";
import { layerConfigAtom } from "src/state/jotai";
import { useAuth } from "src/auth";
import { ILayerConfig } from "src/types";
import { maybeDeleteOldMapboxLayer } from "src/components/layers/popover";

export const satelliteLimitedZoom = 16;

export const toggleSatelliteShorcut = "b";

export const useToggleSatellite = () => {
  const layerConfigs = useAtomValue(layerConfigAtom);
  const { applyChanges } = useLayerConfigState();
  const { isSignedIn } = useAuth();

  const toggleSatellite = useCallback(() => {
    const items = [...layerConfigs.values()];

    const { deleteLayerConfigs, oldAt, oldMapboxLayer } =
      maybeDeleteOldMapboxLayer(items);

    const newBaseMap =
      oldMapboxLayer && oldMapboxLayer.name === LAYERS.MONOCHROME.name
        ? LAYERS.SATELLITE
        : LAYERS.MONOCHROME;

    const newLayerConfig: ILayerConfig = {
      ...newBaseMap,
      visibility: true,
      tms: false,
      opacity: newBaseMap.opacity,
      at: oldAt || "a0",
      id: newFeatureId(),
      labelVisibility: oldMapboxLayer ? oldMapboxLayer.labelVisibility : true,
      sourceMaxZoom:
        !isSignedIn && newBaseMap.name === LAYERS.SATELLITE.name
          ? { "mapbox-satellite": satelliteLimitedZoom }
          : {},
    };

    applyChanges({
      deleteLayerConfigs,
      putLayerConfigs: [newLayerConfig],
    });
  }, [layerConfigs, applyChanges, isSignedIn]);

  return toggleSatellite;
};
