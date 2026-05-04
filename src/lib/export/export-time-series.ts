import { ExportTimeSeriesMetrics } from "./types";

const LINE_SIZE = 128;

export const estimateTimeSeriesSize = (
  metrics: ExportTimeSeriesMetrics[],
  numAssets: number,
  timestepCount: number,
) => numAssets * metrics.length * timestepCount * LINE_SIZE;
