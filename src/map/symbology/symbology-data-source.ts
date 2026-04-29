import { HydraulicModel } from "src/hydraulic-model";
import { getSortedValues } from "src/hydraulic-model/assets-map";
import { EPSResultsReader } from "src/simulation/epanet/eps-results-reader";
import {
  type ResultsReader,
  type SimulationProperty,
  isSimulationProperty,
} from "src/simulation/results-reader";

export {
  simulationProperties,
  isSimulationProperty,
  type SimulationProperty,
} from "src/simulation/results-reader";

export const getSortedSimulationValues = (
  resultsReader: ResultsReader,
  property: SimulationProperty,
  { absValues = false }: { absValues?: boolean } = {},
): number[] => {
  let values = resultsReader.getAllValues(property);
  if (absValues) {
    values = values.map(Math.abs);
  }
  return values.sort((a, b) => a - b);
};

export type BreaksDataMode = "currentStep" | "initial" | "allSteps";

export type SimulationDataSource =
  | { mode: "currentStep"; resultsReader: ResultsReader }
  | {
      mode: "initial";
      epsReader: EPSResultsReader;
      resultsReader?: ResultsReader | null;
    }
  | {
      mode: "allSteps";
      epsReader: EPSResultsReader;
      resultsReader?: ResultsReader | null;
    };

export const getSortedSimulationDataForBreaks = async (
  property: SimulationProperty,
  source: SimulationDataSource,
  options?: { absValues?: boolean },
): Promise<number[] | null> => {
  switch (source.mode) {
    case "currentStep":
      return getSortedSimulationValues(source.resultsReader, property, options);
    case "initial": {
      const data = await getInitialSortedValues(
        source.epsReader,
        property,
        options,
      );
      if (data) return data;
      return source.resultsReader
        ? getSortedSimulationValues(source.resultsReader, property, options)
        : null;
    }
    case "allSteps": {
      const data = await getAllStepsSortedValues(
        source.epsReader,
        property,
        options,
      );
      if (data) return data;
      return source.resultsReader
        ? getSortedSimulationValues(source.resultsReader, property, options)
        : null;
    }
  }
};

const getAllStepsSortedValues = async (
  epsReader: EPSResultsReader,
  property: SimulationProperty,
  options?: { absValues?: boolean },
): Promise<number[] | null> => {
  const timestepCount = epsReader.timestepCount;
  if (timestepCount <= 0) return null;

  const firstReader = await epsReader.getResultsForTimestep(0);
  const firstValues = getSortedSimulationValues(firstReader, property, options);
  const valuesPerTimestep = firstValues.length;
  if (timestepCount === 1) return firstValues;

  const allValues = new Float32Array(valuesPerTimestep * timestepCount);
  for (let i = 0; i < valuesPerTimestep; i++) {
    allValues[i] = firstValues[i];
  }

  for (let t = 1; t < timestepCount; t++) {
    const reader = await epsReader.getResultsForTimestep(t);
    const values = getSortedSimulationValues(reader, property, options);
    const offset = t * valuesPerTimestep;
    for (let i = 0; i < values.length; i++) {
      allValues[offset + i] = values[i];
    }
  }

  allValues.sort();
  return Array.from(allValues);
};

const getInitialSortedValues = async (
  epsReader: EPSResultsReader,
  property: SimulationProperty,
  options?: { absValues?: boolean },
): Promise<number[] | null> => {
  const lastIndex = epsReader.timestepCount - 1;
  if (lastIndex < 0) return null;

  const firstReader = await epsReader.getResultsForTimestep(0);
  const firstValues = getSortedSimulationValues(firstReader, property, options);
  if (lastIndex === 0) return firstValues;

  const lastReader = await epsReader.getResultsForTimestep(lastIndex);
  const lastValues = getSortedSimulationValues(lastReader, property, options);
  return mergeSorted(firstValues, lastValues);
};

const mergeSorted = (a: number[], b: number[]): number[] => {
  const result: number[] = new Array(a.length + b.length);
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < a.length && j < b.length) {
    if (a[i] <= b[j]) {
      result[k++] = a[i++];
    } else {
      result[k++] = b[j++];
    }
  }
  while (i < a.length) result[k++] = a[i++];
  while (j < b.length) result[k++] = b[j++];
  return result;
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
