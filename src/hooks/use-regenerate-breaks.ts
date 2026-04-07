import { useAtomValue } from "jotai";
import { useCallback, useMemo } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import {
  applyMode,
  type RangeColorRule,
} from "src/map/symbology/range-color-rule";
import { getSortedDataForProperty } from "src/map/symbology/symbology-data-source";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { useSymbologyState } from "src/state/map-symbology";
import { simulationResultsAtom } from "src/state/simulation";

export type RegenerateResult = {
  colorRule: RangeColorRule;
  error?: boolean;
};

export const useRegenerateBreaks = (geometryType: "node" | "link") => {
  const userTracking = useUserTracking();
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const simulationResults = useAtomValue(simulationResultsAtom);
  const { nodeSymbology, linkSymbology } = useSymbologyState();

  const symbology = geometryType === "node" ? nodeSymbology : linkSymbology;
  const colorRule = symbology.colorRule;

  const sortedData = useMemo(() => {
    if (!colorRule) return [];
    return getSortedDataForProperty(
      colorRule.property,
      hydraulicModel,
      simulationResults,
      { absValues: Boolean(colorRule.absValues) },
    );
  }, [colorRule, hydraulicModel, simulationResults]);

  const regenerate = useCallback(
    (currentRule: RangeColorRule): RegenerateResult => {
      userTracking.capture({
        name: "colorRange.breaks.regenerated",
        property: currentRule.property,
      });
      return applyMode(currentRule, currentRule.mode, sortedData);
    },
    [userTracking, sortedData],
  );

  return { sortedData, regenerate };
};
