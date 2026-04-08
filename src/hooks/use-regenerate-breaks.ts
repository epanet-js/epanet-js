import { useAtomValue } from "jotai";
import { useCallback, useMemo, useState } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import {
  applyMode,
  type RangeColorRule,
} from "src/map/symbology/range-color-rule";
import {
  getSortedDataForProperty,
  getSortedSimulationDataForBreaks,
  isSimulationProperty,
} from "src/map/symbology/symbology-data-source";
import { getSimulationMetadata } from "src/simulation/epanet/simulation-metadata";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { useSymbologyState } from "src/state/map-symbology";
import { simulationAtom, simulationResultsAtom } from "src/state/simulation";

export type RegenerateResult = {
  colorRule: RangeColorRule;
  error?: boolean;
};

export const useRegenerateBreaks = (geometryType: "node" | "link") => {
  const userTracking = useUserTracking();
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const simulationResults = useAtomValue(simulationResultsAtom);
  const simulation = useAtomValue(simulationAtom);
  const { nodeSymbology, linkSymbology } = useSymbologyState();
  const isSymbologyFromAllDataOn = useFeatureFlag(
    "FLAG_SYMBOLOGY_FROM_ALL_DATA",
  );
  const [isWorking, setIsWorking] = useState(false);

  const symbology = geometryType === "node" ? nodeSymbology : linkSymbology;
  const colorRule = symbology.colorRule;

  const epsResultsReader =
    simulation.status === "success" || simulation.status === "warning"
      ? simulation.epsResultsReader
      : undefined;

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

  const isEpsSimulation =
    (simulation.status === "success" || simulation.status === "warning") &&
    !!simulation.metadata &&
    getSimulationMetadata(simulation.metadata).reportingStepsCount > 1;

  const canRegenerateFromAllData =
    isSymbologyFromAllDataOn &&
    isEpsSimulation &&
    !!colorRule &&
    isSimulationProperty(colorRule.property);

  const regenerateFromAllData = useCallback(
    async (currentRule: RangeColorRule): Promise<RegenerateResult | null> => {
      if (!isSimulationProperty(currentRule.property)) return null;

      userTracking.capture({
        name: "colorRange.breaks.regeneratedFromAllData",
        property: currentRule.property,
      });

      if (!epsResultsReader) return null;

      setIsWorking(true);
      try {
        const fullSorted = await getSortedSimulationDataForBreaks(
          currentRule.property,
          { mode: "allSteps", epsReader: epsResultsReader },
          { absValues: Boolean(currentRule.absValues) },
        );
        if (!fullSorted) return null;

        return applyMode(currentRule, currentRule.mode, fullSorted);
      } finally {
        setIsWorking(false);
      }
    },
    [userTracking, epsResultsReader],
  );

  return {
    sortedData,
    regenerate,
    regenerateFromAllData,
    canRegenerateFromAllData,
    isWorking,
  };
};
