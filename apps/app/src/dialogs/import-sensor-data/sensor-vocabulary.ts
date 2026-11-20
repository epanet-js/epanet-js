import { useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { QUICK_GRAPH_PROPERTIES } from "src/lib/asset-graph";
import {
  ASSET_TYPES,
  type SensorVocabulary,
} from "src/lib/sensor-data/parameters";

type Translate = (key: string) => string;

export const buildSensorVocabulary = (
  translate: Translate,
): SensorVocabulary => ({
  parameters: Object.fromEntries(
    ASSET_TYPES.map((assetType) => [
      assetType,
      Object.fromEntries(
        QUICK_GRAPH_PROPERTIES[assetType].map(({ value, labelKey }) => [
          value,
          [translate(labelKey)],
        ]),
      ),
    ]),
  ),
  assetTypes: Object.fromEntries(
    ASSET_TYPES.map((assetType) => [assetType, [translate(assetType)]]),
  ),
});

export const useSensorVocabulary = (): SensorVocabulary => {
  const translate = useTranslate();
  return useMemo(() => buildSensorVocabulary(translate), [translate]);
};
