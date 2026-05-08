import { Asset, HydraulicModel } from "src/hydraulic-model";
import { ExportTimeSeriesMetrics } from "./types";
import { EPSResultsReader } from "src/simulation";
import { FileSystemHelpers } from "./file-system-helpers";
import { TimeSeries } from "src/simulation/epanet/eps-results-reader";

export const estimateTimeSeriesSize = (
  metrics: ExportTimeSeriesMetrics[],
  numAssets: number,
  timestepCount: number,
) => numAssets * metrics.length * lineSize(timestepCount);

export const exportTimeSeries = async (
  networkName: string,
  directory: FileSystemDirectoryHandle,
  hydraulicModel: HydraulicModel,
  resultsReader: EPSResultsReader,
  selectedAssets: Set<number>,
  metrics: ExportTimeSeriesMetrics[],
  onProgress: (progressPercentage: number) => void,
  signal?: AbortSignal,
) => {
  const encoder = new TextEncoder();
  const buffer = new Uint8Array(lineSize(resultsReader.timestepCount));
  const hasSelection = selectedAssets.size > 0;
  const totalProgress = metrics.length * hydraulicModel.assets.size;
  let progress = 1;

  for (const metric of metrics) {
    signal?.throwIfAborted();

    const fileName = `${networkName}-export-${metric}.csv`;
    const handle = await directory.getFileHandle(fileName, { create: true });
    const stream = await handle.createWritable();

    try {
      const offset = encodeHeader(
        buffer,
        resultsReader.timestepCount,
        resultsReader.reportingTimeStep,
        encoder,
      );
      const view = buffer.subarray(0, offset);
      await stream.write(view);

      for (const asset of hydraulicModel.assets.values()) {
        signal?.throwIfAborted();

        const epanetType = asset.isLink ? "link" : "node";
        const results = await resultsReader.getTimeSeries(
          asset.id,
          asset.type,
          metric,
        );

        onProgress((progress++ / totalProgress) * 100);

        if (hasSelection && !selectedAssets.has(asset.id)) continue;
        if (results === null) continue;
        if (!METRICS_BY_TYPE[epanetType].has(metric)) continue;

        const offset = encodeValues(buffer, asset, results, encoder, metric);

        const view = buffer.subarray(0, offset);
        await stream.write(view);
      }

      await stream.close();
    } catch (err) {
      await stream.abort();
      throw err;
    }

    if (!FileSystemHelpers.isFileSystemAccessSupported()) {
      await FileSystemHelpers.triggerDownload(fileName, handle);
    }
  }
};

const lineSize = (timestepCount: number) => 64 * (timestepCount + 2);

const mapLinkStatus = (status: number) => (status < 3 ? "closed" : "open");

const encodeHeader = (
  buffer: Uint8Array,
  timestepCount: number,
  reportingTimeStep: number,
  encoder: TextEncoder,
) => {
  buffer.fill(0);
  let { written: offset } = encoder.encodeInto(`id,type,`, buffer);

  for (let i = 0; i < timestepCount; i++) {
    const { written } = encoder.encodeInto(
      `${formatTimestepTime(i, reportingTimeStep)},`,
      buffer.subarray(offset),
    );
    offset += written;
  }

  encoder.encodeInto("\n", buffer.subarray(offset - 1));

  return offset;
};

const encodeValues = (
  buffer: Uint8Array,
  asset: Asset,
  results: TimeSeries,
  encoder: TextEncoder,
  metric: ExportTimeSeriesMetrics,
) => {
  buffer.fill(0);
  let { written: offset } = encoder.encodeInto(
    `${asset.label},${asset.type},`,
    buffer,
  );

  for (let i = 0; i < results.values.length; i++) {
    const raw = results.values[i];
    const value = metric === "status" ? mapLinkStatus(raw) : raw.toFixed(4);

    const { written } = encoder.encodeInto(
      `${value},`,
      buffer.subarray(offset),
    );
    offset += written;
  }

  encoder.encodeInto("\n", buffer.subarray(offset - 1));

  return offset;
};

const METRICS_BY_TYPE = {
  node: new Set(["pressure", "head", "demand", "waterQuality"]),
  link: new Set(["flow", "velocity", "unitHeadloss", "status"]),
};

const formatTimestepTime = (
  timestepIndex: number,
  reportingTimeStep: number,
) => {
  const totalSeconds = timestepIndex * reportingTimeStep;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};
