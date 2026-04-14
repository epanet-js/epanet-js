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
import { stagingModelAtom } from "src/state/hydraulic-model";
import {
  simulationDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { useSymbologyState } from "src/state/map-symbology";
import { simulationAtom, simulationResultsAtom } from "src/state/simulation";
import { simulationResultsDerivedAtom } from "src/state/derived-branch-state";

export type RegenerateResult = {
  colorRule: RangeColorRule;
  error?: boolean;
};

export const useRegenerateBreaks = (geometryType: "node" | "link") => {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const userTracking = useUserTracking();
  const hydraulicModel = useAtomValue(
    isStateRefactorOn ? stagingModelDerivedAtom : stagingModelAtom,
  );
  const simulationResults = useAtomValue(
    isStateRefactorOn ? simulationResultsDerivedAtom : simulationResultsAtom,
  );
  const simulation = useAtomValue(
    isStateRefactorOn ? simulationDerivedAtom : simulationAtom,
  );
  const { nodeSymbology, linkSymbology } = useSymbologyState();

  const [isWorking, setIsWorking] = useState(false);

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

  const isEpsSimulation =
    "epsResultsReader" in simulation &&
    (simulation.epsResultsReader?.timestepCount ?? 0) > 1;

  const canRegenerateFromAllData =
    isEpsSimulation && !!colorRule && isSimulationProperty(colorRule.property);

  const regenerateFromAllData = useCallback(
    async (currentRule: RangeColorRule): Promise<RegenerateResult | null> => {
      if (!isSimulationProperty(currentRule.property)) return null;

      setIsWorking(true);
      try {
        const epsReader =
          "epsResultsReader" in simulation
            ? simulation.epsResultsReader
            : undefined;
        if (!epsReader) return null;

        userTracking.capture({
          name: "colorRange.breaks.regeneratedFromAllData",
          property: currentRule.property,
        });

        const fullSorted = await getSortedSimulationDataForBreaks(
          currentRule.property,
          { mode: "allSteps", epsReader },
          { absValues: Boolean(currentRule.absValues) },
        );
        if (!fullSorted) return null;

        return applyMode(currentRule, currentRule.mode, fullSorted);
      } finally {
        setIsWorking(false);
      }
    },
    [simulation, userTracking],
  );

  return {
    sortedData,
    regenerate,
    regenerateFromAllData,
    canRegenerateFromAllData,
    isWorking,
  };
};
