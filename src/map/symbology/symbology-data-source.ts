import { HydraulicModel } from "src/hydraulic-model";
import { getSortedValues } from "src/hydraulic-model/assets-map";
import { type ResultsReader } from "src/simulation/results-reader";

export const simulationProperties = [
  "flow",
  "velocity",
  "unitHeadloss",
  "pressure",
  "actualDemand",
  "head",
  "waterAge",
] as const;

export type SimulationProperty = (typeof simulationProperties)[number];

export const isSimulationProperty = (
  property: string,
): property is SimulationProperty => {
  return simulationProperties.includes(property as SimulationProperty);
};

export const getSortedSimulationValues = (
  resultsReader: ResultsReader,
  property: SimulationProperty,
  { absValues = false }: { absValues?: boolean } = {},
): number[] => {
  let values: number[];
  switch (property) {
    case "pressure":
      values = resultsReader.getAllPressures();
      break;
    case "head":
      values = resultsReader.getAllHeads();
      break;
    case "actualDemand":
      values = resultsReader.getAllDemands();
      break;
    case "flow":
      values = resultsReader.getAllFlows();
      break;
    case "velocity":
      values = resultsReader.getAllVelocities();
      break;
    case "unitHeadloss":
      values = resultsReader.getAllUnitHeadlosses();
      break;
    case "waterAge":
      values = resultsReader.getAllWaterAges();
      break;
  }
  if (absValues) {
    values = values.map(Math.abs);
  }
  return values.sort((a, b) => a - b);
};

export type BreaksDataMode = "currentStep";

export type SimulationDataSource = {
  mode: "currentStep";
  resultsReader: ResultsReader;
};

/**
 * Returns the sorted values to use for break generation for a simulation
 * property. The discriminated `source` carries everything each mode needs;
 * future modes (`initial`, `allSteps`) will widen the union and require an
 * `EPSResultsReader` rather than a per-step `ResultsReader`.
 */
export const getSortedSimulationDataForBreaks = (
  property: SimulationProperty,
  source: SimulationDataSource,
  options?: { absValues?: boolean },
): Promise<number[] | null> => {
  switch (source.mode) {
    case "currentStep":
      return Promise.resolve(
        getSortedSimulationValues(source.resultsReader, property, options),
      );
  }
};

/**
 * Synchronous helper for the common "current visible timestep" path. Used by
 * the regenerate hook and the symbology builders, which both run inline and
 * don't need the async dispatch wrapper.
 */
export const getSortedDataForProperty = (
  property: string,
  hydraulicModel: HydraulicModel,
  resultsReader: ResultsReader | null,
  options?: { absValues?: boolean },
): number[] => {
  if (resultsReader && isSimulationProperty(property)) {
    return getSortedSimulationValues(resultsReader, property, options);
  }
  return getSortedValues(hydraulicModel.assets, property, options);
};
