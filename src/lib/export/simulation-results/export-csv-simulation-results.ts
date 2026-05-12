import { Asset, HydraulicModel } from "src/hydraulic-model";
import {
  ALL_METRICS,
  ExportTimeSeriesMetrics,
  SimulationResultsOptions,
} from "../types";
import { EPSResultsReader } from "src/simulation";
import { FileSystemHelpers } from "../file-system-helpers";
import { TimeSeries } from "src/simulation/epanet/eps-results-reader";
import { NUM_DECIMAL_PLACES } from "../constants";

export const exportCsvSimulationResults = async (
  networkName: string,
  directory: FileSystemDirectoryHandle,
  hydraulicModel: HydraulicModel,
  resultsReader: EPSResultsReader,
  options?: SimulationResultsOptions,
) => {
  const selectedAssets = options?.selectedAssets ?? new Set<number>();
  const metrics = options?.metrics ?? ALL_METRICS;
  const onProgress = options?.onProgress;
  const signal = options?.signal;
  const encoder = new TextEncoder();
  const headerBuf = new Uint8Array(lineSize(resultsReader.timestepCount));
  const maxRowSize = lineSize(resultsReader.timestepCount);
  const hasSelection = selectedAssets.size > 0;
  const totalProgress = metrics.length * hydraulicModel.assets.size;
  let progress = 1;

  const streams = new Map<
    ExportTimeSeriesMetrics,
    FileSystemWritableFileStream
  >();
  const handles = new Map<ExportTimeSeriesMetrics, FileSystemFileHandle>();
  const buffers = new Map<ExportTimeSeriesMetrics, Uint8Array>();
  const offsets = new Map<ExportTimeSeriesMetrics, number>();

  try {
    for (const metric of metrics) {
      signal?.throwIfAborted();
      const fileName = `${networkName}-export-${metric}.csv`;
      const handle = await directory.getFileHandle(fileName, { create: true });
      const stream = await handle.createWritable();
      handles.set(metric, handle);
      streams.set(metric, stream);
      buffers.set(metric, new Uint8Array(BATCH_SIZE));
      offsets.set(metric, 0);

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
        if (onProgress) await onProgress((progress++ / totalProgress) * 100);

        const epanetType = asset.isLink ? "link" : "node";
        if (hasSelection && !selectedAssets.has(asset.id)) return;
        if (results === null) return;
        if (!METRICS_BY_TYPE[epanetType].has(metric)) return;

        const buffer = buffers.get(metric)!;
        let offset = offsets.get(metric)!;

        if (offset + maxRowSize > BATCH_SIZE) {
          await streams.get(metric)!.write(buffer.subarray(0, offset));
          offset = 0;
        }

        const written = encodeValues(
          buffer.subarray(offset),
          asset,
          results,
          encoder,
          metric,
        );
        offsets.set(metric, offset + written);
      },
      signal,
    );

    for (const metric of metrics) {
      const offset = offsets.get(metric)!;
      if (offset > 0) {
        await streams
          .get(metric)!
          .write(buffers.get(metric)!.subarray(0, offset));
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

// Writes a float32 value as ASCII bytes directly into buf at off,
// using NUM_DECIMAL_PLACES decimal digits. Returns the new offset.
// Avoids string allocation entirely.
const FLOAT_SCALE = 10 ** NUM_DECIMAL_PLACES;
const encodeFloat = (
  buffer: Uint8Array,
  offset: number,
  value: number,
): number => {
  const UTF8_ZERO = 48;
  const UTF8_DOT = 46;
  const UTF8_MINUS_SIGN = 45;

  if (!isFinite(value)) {
    buffer[offset++] = UTF8_ZERO;
    buffer[offset++] = UTF8_DOT;
    for (let i = 0; i < NUM_DECIMAL_PLACES; i++) {
      buffer[offset++] = UTF8_ZERO;
    }
    return offset;
  }

  if (value < 0) {
    buffer[offset++] = UTF8_MINUS_SIGN;
    value = -value;
  }

  const scaled = Math.round(value * FLOAT_SCALE);
  const frac = scaled % FLOAT_SCALE;
  let integerPart = (scaled / FLOAT_SCALE) | 0;

  if (integerPart === 0) {
    buffer[offset++] = UTF8_ZERO;
  } else {
    const start = offset;
    while (integerPart > 0) {
      buffer[offset++] = UTF8_ZERO + (integerPart % 10);
      integerPart = (integerPart / 10) | 0;
    }

    // digits were written least-significant first — reverse them
    for (let l = start, r = offset - 1; l < r; l++, r--) {
      const tmp = buffer[l];
      buffer[l] = buffer[r];
      buffer[r] = tmp;
    }
  }

  buffer[offset++] = UTF8_DOT;
  for (let d = NUM_DECIMAL_PLACES - 1; d >= 0; d--) {
    buffer[offset++] = UTF8_ZERO + (Math.floor(frac / 10 ** d) % 10);
  }
  return offset;
};

const UTF8_STATUS_CLOSED = new TextEncoder().encode("closed,");
const UTF8_STATUS_OPEN = new TextEncoder().encode("open,");

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

const getStatus = (status: number) =>
  status < 3 ? UTF8_STATUS_CLOSED : UTF8_STATUS_OPEN;

const encodeValues = (
  buffer: Uint8Array,
  asset: Asset,
  results: TimeSeries,
  encoder: TextEncoder,
  metric: ExportTimeSeriesMetrics,
): number => {
  const UTF8_COMMA = 44;
  const UTF8_NEW_LINE = 10;

  let { written: offset } = encoder.encodeInto(
    `${asset.label},${asset.type},`,
    buffer,
  );

  const values = results.values;
  if (metric === "status") {
    for (let i = 0; i < values.length; i++) {
      const bytes = getStatus(values[i]);
      buffer.set(bytes, offset);
      offset += bytes.length;
    }
  } else {
    for (let i = 0; i < values.length; i++) {
      offset = encodeFloat(buffer, offset, values[i]);
      buffer[offset++] = UTF8_COMMA;
    }
  }

  buffer[offset - 1] = UTF8_NEW_LINE;
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

const BATCH_SIZE = 4 * 1024 * 1024;
