import { useAtom } from "jotai";
import { sortAts } from "src/lib/parse-stored";
import { useCallback } from "react";
import { ILayerConfig } from "src/types";
import { layerConfigAtom } from "src/state/map";

export const useLayerConfigState = () => {
  const [layerConfigMap, setLayerConfig] = useAtom(layerConfigAtom);

  const applyChanges = useCallback(
    ({
      putLayerConfigs = [],
      deleteLayerConfigs = [],
    }: {
      putLayerConfigs?: ILayerConfig[];
      deleteLayerConfigs?: ILayerConfig["id"][];
    }) => {
      const newLayerConfigMap = new Map([...layerConfigMap]);
      for (const newLayer of putLayerConfigs) {
        newLayerConfigMap.set(newLayer.id, newLayer);
      }

      for (const layerId of deleteLayerConfigs) {
        newLayerConfigMap.delete(layerId);
      }

      setLayerConfig(
        new Map(
          Array.from(newLayerConfigMap).sort((a, b) => {
            return sortAts(a[1], b[1]);
          }),
        ),
      );
    },
    [setLayerConfig, layerConfigMap],
  );

  return {
    applyChanges,
  };
};

/**
 * If there's an existing Mapbox style layer
 * in the stack, replace it and use its `at` value.
 */
export function maybeDeleteOldMapboxLayer(items: ILayerConfig[]): {
  deleteLayerConfigs: ILayerConfig["id"][];
  oldAt: string | undefined;
  oldMapboxLayer: ILayerConfig | undefined;
} {
  let oldAt: string | undefined;
  const oldMapboxLayer = items.find((layer) => layer.type === "MAPBOX");
  const deleteLayerConfigs: string[] = [];

  if (oldMapboxLayer) {
    oldAt = oldMapboxLayer.at;
    deleteLayerConfigs.push(oldMapboxLayer.id);
  }
  return { oldAt, deleteLayerConfigs, oldMapboxLayer };
}
