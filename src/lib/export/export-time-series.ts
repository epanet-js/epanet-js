import { HydraulicModel } from "src/hydraulic-model";
import { ExportTimeSeriesMetrics } from "./types";
import { EPSResultsReader } from "src/simulation";
import { FileSystemHelpers } from "./file-system-helpers";

const LINE_SIZE = 128;

export const estimateTimeSeriesSize = (
  metrics: ExportTimeSeriesMetrics[],
  numAssets: number,
  timestepCount: number,
) => numAssets * metrics.length * timestepCount * LINE_SIZE;

export const exportTimeSeries = async (
  directory: FileSystemDirectoryHandle,
  hydraulicModel: HydraulicModel,
  resultsReader: EPSResultsReader,
  selectedAssets: Set<number>,
  metrics: ExportTimeSeriesMetrics[],
  onProgress: (progress: number) => void,
) => {
  const numAssets =
    selectedAssets.size > 0 ? selectedAssets.size : hydraulicModel.assets.size;
  const numSteps = resultsReader.timestepCount * numAssets * metrics.length;
  const step = 0;

  const encoder = new TextEncoder();
  const buffer = new Uint8Array(4096);

  for (const metric of metrics) {
    const fileName = `export_${metric}.csv`;
    const handle = await directory.getFileHandle(fileName, { create: true });
    const stream = await handle.createWritable();

    hydraulicModel.assets.forEach(async (asset) => {
      onProgress((step / numSteps) * 100);

      buffer.fill(0);
      encoder.encodeInto(`${asset.label}\n`, buffer);

      await stream.write(buffer);
    });

    await stream.close();

    if (!FileSystemHelpers.isFileSystemAccessSupported()) {
      await FileSystemHelpers.triggerDownload(fileName, handle);
    }
  }
};
