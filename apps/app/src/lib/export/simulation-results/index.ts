import { ExportSimulationResultsProperties } from "../types";
export { exportCsvSimulationResults } from "./export-csv-simulation-results";
export { exportXlsxSimulationResults } from "./export-xlsx-simulation-results";

const XML_INFLATION_RATIO = 1.3;

export const estimateSimulationResultsSize = (
  format: "csv" | "xlsx",
  metrics: ExportSimulationResultsProperties[],
  numAssets: number,
  timestepCount: number,
) => {
  const rawSize = numAssets * metrics.length * lineSize(timestepCount);
  return format === "xlsx" ? XML_INFLATION_RATIO * rawSize : rawSize;
};

const lineSize = (timestepCount: number) => 16 * timestepCount + 64;
