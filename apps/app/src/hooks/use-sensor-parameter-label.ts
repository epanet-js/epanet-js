import { useCallback } from "react";
import { useAtomValue } from "jotai";
import type { AssetType } from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import { QUICK_GRAPH_PROPERTIES } from "src/lib/asset-graph";
import type { SensorParameter } from "src/lib/sensor-data/parameters";

export const useSensorParameterLabel = () => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const { units } = useAtomValue(projectSettingsAtom);

  return useCallback(
    (parameter: SensorParameter, assetType: AssetType) => {
      const option = QUICK_GRAPH_PROPERTIES[assetType].find(
        ({ value }) => value === parameter,
      );
      if (!option) return "";
      const label = translate(option.labelKey);
      const unit = parameter === "status" ? null : units[option.quantityKey];
      return unit ? `${label} (${translateUnit(unit)})` : label;
    },
    [translate, translateUnit, units],
  );
};
