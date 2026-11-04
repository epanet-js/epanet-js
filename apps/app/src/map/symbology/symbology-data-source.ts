import { HydraulicModel, Pipe } from "src/hydraulic-model";
import { effectiveRoughness } from "@epanet-js/hydraulic-model";
import { getSortedValues } from "@epanet-js/hydraulic-model";
import { EPSResultsReader } from "src/simulation/epanet/eps-results-reader";
import {
  type ResultsReader,
  type SimulationProperty,
  isSimulationProperty,
} from "@epanet-js/simulation";

export {
  simulationProperties,
  isSimulationProperty,
  type SimulationProperty,
} from "@epanet-js/simulation";

const getSimulationValues = (
  resultsReader: ResultsReader,
  property: SimulationProperty,
  { absValues = false }: { absValues?: boolean } = {},
): Float32Array => {
  const values = resultsReader.getAllValues(property);
  if (absValues) {
    for (let i = 0; i < values.length; i++) values[i] = Math.abs(values[i]);
  }
  return values;
};

export const getSortedSimulationValues = (
  resultsReader: ResultsReader,
  property: SimulationProperty,
  options?: { absValues?: boolean },
): number[] =>
  Array.from(getSimulationValues(resultsReader, property, options).sort());

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

  let allValues = new Float32Array(0);
  let totalValues = 0;
  for (let t = 0; t < timestepCount; t++) {
    const reader = await epsReader.getResultsForTimestep(t);
    const values = getSimulationValues(reader, property, options);
    if (totalValues + values.length > allValues.length) {
      const grown = new Float32Array(
        totalValues + values.length * (timestepCount - t),
      );
      grown.set(allValues.subarray(0, totalValues));
      allValues = grown;
    }
    allValues.set(values, totalValues);
    totalValues += values.length;
  }

  return Array.from(allValues.subarray(0, totalValues).sort());
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
  if (property === "roughness") {
    return sortedEffectiveRoughness(hydraulicModel);
  }
  return getSortedValues(hydraulicModel.assets, property, options);
};

const sortedEffectiveRoughness = (hydraulicModel: HydraulicModel): number[] => {
  const values: number[] = [];
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type !== "pipe") continue;

    const value = effectiveRoughness(
      asset as Pipe,
      hydraulicModel.pipeMaterials,
    );
    if (value !== null) values.push(value);
  }
  return values.sort((a, b) => a - b);
};
