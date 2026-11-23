import { useAtomValue } from "jotai";
import { useCallback, useState } from "react";
import {
  applyMode,
  type RangeColorRule,
} from "src/map/symbology/range-color-rule";
import {
  getSortedDataForProperty,
  getSortedSimulationDataForBreaks,
  isSimulationProperty,
} from "src/map/symbology/symbology-data-source";
import {
  simulationDerivedAtom,
  stagingModelDerivedAtom,
  simulationResultsDerivedAtom,
} from "src/state/derived-branch-state";
import { useSymbologyState } from "src/hooks/use-symbology-state";

export type RegenerateResult = {
  colorRule: RangeColorRule;
  error?: boolean;
};

export const useRegenerateBreaks = (geometryType: "node" | "link") => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulationResults = useAtomValue(simulationResultsDerivedAtom);
  const simulation = useAtomValue(simulationDerivedAtom);
  const { nodeSymbology, linkSymbology } = useSymbologyState();

  const [isWorking, setIsWorking] = useState(false);

  const symbology = geometryType === "node" ? nodeSymbology : linkSymbology;
  const colorRule = symbology.colorRule;

  const isEpsSimulation =
    "epsResultsReader" in simulation &&
    (simulation.epsResultsReader?.timestepCount ?? 0) > 1;

  const canRegenerateFromAllData =
    isEpsSimulation && !!colorRule && isSimulationProperty(colorRule.property);

  // Default regenerate: uses first+last step data for EPS simulation properties,
  // falling back to current step data if the EPS source returns nothing.
  // For static properties, falls back to hydraulic model data.
  const regenerate = useCallback(
    async (currentRule: RangeColorRule): Promise<RegenerateResult | null> => {
      const epsReader =
        "epsResultsReader" in simulation
          ? simulation.epsResultsReader
          : undefined;

      if (epsReader && isSimulationProperty(currentRule.property)) {
        setIsWorking(true);
        try {
          const data = await getSortedSimulationDataForBreaks(
            currentRule.property,
            { mode: "initial", epsReader, resultsReader: simulationResults },
            { absValues: Boolean(currentRule.absValues) },
          );
          return data ? applyMode(currentRule, currentRule.mode, data) : null;
        } finally {
          setIsWorking(false);
        }
      }

      const data = getSortedDataForProperty(
        currentRule.property,
        hydraulicModel,
        simulationResults,
        { absValues: Boolean(currentRule.absValues) },
      );
      return applyMode(currentRule, currentRule.mode, data);
    },
    [simulation, simulationResults, hydraulicModel],
  );

  const regenerateFromCurrentStep = useCallback(
    async (currentRule: RangeColorRule): Promise<RegenerateResult | null> => {
      if (!isSimulationProperty(currentRule.property) || !simulationResults)
        return null;

      setIsWorking(true);
      try {
        const data = await getSortedSimulationDataForBreaks(
          currentRule.property,
          { mode: "currentStep", resultsReader: simulationResults },
          { absValues: Boolean(currentRule.absValues) },
        );
        if (!data) return null;
        return applyMode(currentRule, currentRule.mode, data);
      } finally {
        setIsWorking(false);
      }
    },
    [simulationResults],
  );

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

        const data = await getSortedSimulationDataForBreaks(
          currentRule.property,
          { mode: "allSteps", epsReader, resultsReader: simulationResults },
          { absValues: Boolean(currentRule.absValues) },
        );
        return data ? applyMode(currentRule, currentRule.mode, data) : null;
      } finally {
        setIsWorking(false);
      }
    },
    [simulation, simulationResults],
  );

  return {
    regenerate,
    regenerateFromCurrentStep,
    regenerateFromAllData,
    canRegenerateFromAllData,
    isWorking,
  };
};
