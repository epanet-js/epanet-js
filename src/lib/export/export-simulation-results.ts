import { HydraulicModel } from "src/hydraulic-model";
import { EPSResultsReader } from "src/simulation";
import { SimulationResultsOptions } from "./types";
import { exportCsvSimulationResults } from "./simulation-results/export-csv-simulation-results";
import { exportXlsxSimulationResults } from "./simulation-results";

export const exportSimulationResults = async (
  format: "csv" | "xlsx",
  networkName: string,
  directory: FileSystemDirectoryHandle,
  hydraulicModel: HydraulicModel,
  resultsReader: EPSResultsReader,
  options?: SimulationResultsOptions,
) => {
  const fn =
    format === "xlsx"
      ? exportXlsxSimulationResults
      : exportCsvSimulationResults;

  await fn(networkName, directory, hydraulicModel, resultsReader, options);
};
