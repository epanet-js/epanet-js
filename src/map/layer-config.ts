import { useAtom } from "jotai";
import { sortAts } from "src/lib/parse-stored";
import { useCallback } from "react";
import { ILayerConfig } from "src/types";
import { layerConfigAtom } from "src/state/jotai";

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
