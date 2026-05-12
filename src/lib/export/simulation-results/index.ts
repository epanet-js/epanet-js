import { ExportSimulationResultsProperties } from "../types";
export { exportCsvSimulationResults } from "./export-csv-simulation-results";
export { exportXlsxSimulationResults } from "./export-xlsx-time-series";

const XML_ZIP_COMPRESSION_RATIO = 0.2;

export const estimateSimulationResultsSize = (
  format: "csv" | "xlsx",
  metrics: ExportSimulationResultsProperties[],
  numAssets: number,
  timestepCount: number,
) => {
  const rawSize = numAssets * metrics.length * lineSize(timestepCount);
  return format === "xlsx" ? XML_ZIP_COMPRESSION_RATIO * rawSize : rawSize;
};

const lineSize = (timestepCount: number) => 16 * timestepCount + 64;
