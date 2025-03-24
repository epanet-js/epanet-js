import { useAtomValue } from "jotai";
import { useCallback } from "react";
import LAYERS from "src/lib/default_layers";
import { newFeatureId } from "src/lib/id";
import { useLayerConfigState } from "src/map/layer-config";
import { layerConfigAtom } from "src/state/jotai";
import { useAuth } from "src/auth";
import { ILayerConfig } from "src/types";
import { isFeatureOn } from "src/infra/feature-flags";
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
    };

    if (!isSignedIn && newBaseMap.name === LAYERS.SATELLITE.name) {
      newLayerConfig.sourceMaxZoom["mapbox-satellite"] = satelliteLimitedZoom;
    }
    applyChanges({
      deleteLayerConfigs,
      putLayerConfigs: [newLayerConfig],
    });
  }, [layerConfigs, applyChanges, isSignedIn]);

  const toggleSatelliteDeprecated = useCallback(() => {
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

    if (!isSignedIn && newBaseMap.name === LAYERS.SATELLITE.name) {
      newLayerConfig.sourceMaxZoom["mapbox-satellite"] = satelliteLimitedZoom;
    }

    applyChanges({
      deleteLayerConfigs: [currentBaseMap.id],
      putLayerConfigs: [newLayerConfig],
    });
  }, [layerConfigs, applyChanges, isSignedIn]);

  return isFeatureOn("FLAG_LAYERS")
    ? toggleSatellite
    : toggleSatelliteDeprecated;
};
