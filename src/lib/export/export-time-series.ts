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

const BATCH_SIZE = 4 * 1024 * 1024; // 4 MB write buffer per metric

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
  const headerBuf = new Uint8Array(lineSize(resultsReader.timestepCount));
  const MAX_ROW_SIZE = lineSize(resultsReader.timestepCount);
  const hasSelection = selectedAssets.size > 0;
  const totalProgress = metrics.length * hydraulicModel.assets.size;
  let progress = 1;

  const streams = new Map<
    ExportTimeSeriesMetrics,
    FileSystemWritableFileStream
  >();
  const handles = new Map<ExportTimeSeriesMetrics, FileSystemFileHandle>();
  const batchBufs = new Map<ExportTimeSeriesMetrics, Uint8Array>();
  const batchOffs = new Map<ExportTimeSeriesMetrics, number>();

  try {
    for (const metric of metrics) {
      signal?.throwIfAborted();
      const fileName = `${networkName}-export-${metric}.csv`;
      const handle = await directory.getFileHandle(fileName, { create: true });
      const stream = await handle.createWritable();
      handles.set(metric, handle);
      streams.set(metric, stream);
      batchBufs.set(metric, new Uint8Array(BATCH_SIZE));
      batchOffs.set(metric, 0);

      const offset = encodeHeader(
        headerBuf,
        resultsReader.timestepCount,
        resultsReader.reportingTimeStep,
        encoder,
      );
      await stream.write(headerBuf.subarray(0, offset));
    }

    await resultsReader.iterateTimeSeries(
      hydraulicModel.assets,
      metrics,
      async (metric, asset, results) => {
        onProgress((progress++ / totalProgress) * 100);

        const epanetType = asset.isLink ? "link" : "node";
        if (hasSelection && !selectedAssets.has(asset.id)) return;
        if (results === null) return;
        if (!METRICS_BY_TYPE[epanetType].has(metric)) return;

        const batchBuf = batchBufs.get(metric)!;
        let batchOff = batchOffs.get(metric)!;

        if (batchOff + MAX_ROW_SIZE > BATCH_SIZE) {
          await streams.get(metric)!.write(batchBuf.subarray(0, batchOff));
          batchOff = 0;
        }

        const rowLen = encodeValues(
          batchBuf.subarray(batchOff),
          asset,
          results,
          encoder,
          metric,
        );
        batchOffs.set(metric, batchOff + rowLen);
      },
      signal,
    );

    for (const metric of metrics) {
      const batchOff = batchOffs.get(metric)!;
      if (batchOff > 0) {
        await streams
          .get(metric)!
          .write(batchBufs.get(metric)!.subarray(0, batchOff));
      }
    }
  } catch (err) {
    for (const stream of streams.values()) {
      try {
        await stream.abort();
      } catch {}
    }
    throw err;
  }

  for (const metric of metrics) {
    const stream = streams.get(metric);
    if (!stream) continue;
    await stream.close();

    if (!FileSystemHelpers.isFileSystemAccessSupported()) {
      const fileName = `${networkName}-export-${metric}.csv`;
      await FileSystemHelpers.triggerDownload(fileName, handles.get(metric)!);
    }
  }
};

const lineSize = (timestepCount: number) => 16 * timestepCount + 64;

const encodeFloat4 = (
  buf: Uint8Array,
  off: number,
  value: number,
  encoder: TextEncoder,
): number => {
  const { written } = encoder.encodeInto(value.toFixed(4), buf.subarray(off));
  return off + written;
};

// Pre-encoded bytes for status labels (including trailing comma)
const STATUS_CLOSED = new Uint8Array([99, 108, 111, 115, 101, 100, 44]); // "closed,"
const STATUS_OPEN = new Uint8Array([111, 112, 101, 110, 44]); // "open,"

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
  buf: Uint8Array,
  asset: Asset,
  results: TimeSeries,
  encoder: TextEncoder,
  metric: ExportTimeSeriesMetrics,
): number => {
  // No fill(0) — every byte is written explicitly below
  let { written: off } = encoder.encodeInto(
    `${asset.label},${asset.type},`,
    buf,
  );

  const values = results.values;
  if (metric === "status") {
    for (let i = 0; i < values.length; i++) {
      const bytes = values[i] < 3 ? STATUS_CLOSED : STATUS_OPEN;
      buf.set(bytes, off);
      off += bytes.length;
    }
  } else {
    for (let i = 0; i < values.length; i++) {
      off = encodeFloat4(buf, off, values[i], encoder);
      buf[off++] = 44; // ','
    }
  }

  buf[off - 1] = 10; // replace trailing ',' with '\n'
  return off;
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
