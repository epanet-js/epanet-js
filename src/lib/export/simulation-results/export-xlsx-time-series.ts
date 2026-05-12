import { Zip, ZipDeflate } from "fflate";
import { HydraulicModel } from "src/hydraulic-model";
import { EPSResultsReader } from "src/simulation";
import {
  ALL_METRICS,
  ExportSimulationResultsProperties,
  SimulationResultsOptions,
} from "../types";
import { FileSystemHelpers } from "../file-system-helpers";
import { NUM_DECIMAL_PLACES } from "../constants";

export const exportXlsxSimulationResults = async (
  networkName: string,
  directory: FileSystemDirectoryHandle,
  hydraulicModel: HydraulicModel,
  resultsReader: EPSResultsReader,
  options?: SimulationResultsOptions,
) => {
  const selectedAssets = options?.selectedAssets ?? new Set<number>();
  const metrics = options?.properties ?? ALL_METRICS;
  const onProgress = options?.onProgress;
  const signal = options?.signal;

  signal?.throwIfAborted();

  const sheetNames = metrics.map((m) => METRIC_SHEET_NAMES[m]);
  const fileName = `${networkName}-export.xlsx`;
  const handle = await directory.getFileHandle(fileName, { create: true });
  const stream = await handle.createWritable();

  const numTimestepCols = resultsReader.timestepCount;
  const totalCols = 2 + numTimestepCols;

  const colLetters: string[] = new Array(totalCols);
  for (let i = 0; i < totalCols; i++) {
    colLetters[i] = colLetter(i);
  }

  const headerRowXml = buildHeaderRowXml(
    resultsReader.timestepCount,
    resultsReader.reportingTimeStep,
    colLetters,
  );

  const rowBufferSize = Math.max(64 * 1024, totalCols * 50);
  const rowBuffer = new Uint8Array(rowBufferSize);
  const encoder = new TextEncoder();

  const hasSelection = selectedAssets.size > 0;
  const totalProgress = metrics.length * hydraulicModel.assets.size;
  let progress = 1;

  try {
    await new Promise<void>((resolve, reject) => {
      const zip = new Zip(async (err, data, final) => {
        if (err) {
          reject(err);
          return;
        }
        await stream.write(data);
        if (final) resolve();
      });

      try {
        pushStaticEntry(
          zip,
          "[Content_Types].xml",
          contentTypesXml(sheetNames),
        );
        pushStaticEntry(zip, "_rels/.rels", packageRelsXml());
        pushStaticEntry(zip, "xl/workbook.xml", workbookXml(sheetNames));
        pushStaticEntry(
          zip,
          "xl/_rels/workbook.xml.rels",
          workbookRelsXml(sheetNames),
        );

        let currentMetric: string | null = null;
        let currentEntry: ZipDeflate | null = null;
        let rowCount = 0;
        const writtenMetrics = new Set<string>();

        const iterationPromise = resultsReader.iterateTimeSeries(
          hydraulicModel.assets,
          metrics,
          async (metric, asset, results) => {
            if (onProgress)
              await onProgress((progress++ / totalProgress) * 100);

            if (metric !== currentMetric) {
              if (currentEntry) closeSheetEntry(currentEntry);
              const sheetIndex = metrics.indexOf(
                metric as ExportSimulationResultsProperties,
              );
              currentEntry = openSheetEntry(zip, sheetIndex + 1);
              pushEncodedRow(currentEntry, headerRowXml, rowBuffer, encoder);
              currentMetric = metric;
              rowCount = 1;
              writtenMetrics.add(metric);
            }

            const epanetType = asset.isLink ? "link" : "node";
            if (hasSelection && !selectedAssets.has(asset.id)) return;
            if (results === null) return;
            if (!METRICS_BY_TYPE[epanetType].has(metric)) return;

            if (rowCount >= MAX_ROWS) {
              throw new Error(
                `Sheet exceeds Excel's ${MAX_ROWS.toLocaleString()} row limit`,
              );
            }

            ++rowCount;
            const rowXml = buildDataRowXml(
              rowCount,
              asset.label,
              asset.type,
              results.values,
              metric as ExportSimulationResultsProperties,
              colLetters,
            );
            pushEncodedRow(currentEntry!, rowXml, rowBuffer, encoder);
          },
          signal,
        );

        iterationPromise
          .then(() => {
            if (currentEntry) closeSheetEntry(currentEntry);

            for (let i = 0; i < metrics.length; i++) {
              if (!writtenMetrics.has(metrics[i])) {
                const entry = openSheetEntry(zip, i + 1);
                pushEncodedRow(entry, headerRowXml, rowBuffer, encoder);
                closeSheetEntry(entry);
              }
            }

            zip.end();
          })
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    });

    await stream.close();
  } catch (err) {
    await stream.abort();
    throw err;
  }

  if (!FileSystemHelpers.isFileSystemAccessSupported()) {
    await FileSystemHelpers.triggerDownload(fileName, handle);
  }
};

const buildHeaderRowXml = (
  timestepCount: number,
  reportingTimeStep: number,
  colLetters: string[],
): string => {
  let xml = `<row r="1">`;
  xml += `<c r="${colLetters[0]}1" t="inlineStr"><is><t>id</t></is></c>`;
  xml += `<c r="${colLetters[1]}1" t="inlineStr"><is><t>type</t></is></c>`;
  for (let i = 0; i < timestepCount; i++) {
    const time = formatTimestepTime(i, reportingTimeStep);
    xml += `<c r="${colLetters[i + 2]}1" t="inlineStr"><is><t>${time}</t></is></c>`;
  }
  xml += `</row>`;
  return xml;
};

const buildDataRowXml = (
  rowIndex: number,
  label: string,
  assetType: string,
  values: Float32Array,
  metric: ExportSimulationResultsProperties,
  colLetters: string[],
): string => {
  let xml = `<row r="${rowIndex}">`;
  xml += `<c r="${colLetters[0]}${rowIndex}" t="inlineStr"><is><t>${escapeXml(label)}</t></is></c>`;
  xml += `<c r="${colLetters[1]}${rowIndex}" t="inlineStr"><is><t>${assetType}</t></is></c>`;

  if (metric === "status") {
    for (let i = 0; i < values.length; i++) {
      const status = values[i] < 3 ? "closed" : "open";
      xml += `<c r="${colLetters[i + 2]}${rowIndex}" t="inlineStr"><is><t>${status}</t></is></c>`;
    }
  } else {
    for (let i = 0; i < values.length; i++) {
      const v =
        Math.trunc(values[i]) === values[i]
          ? values[i]
          : values[i].toFixed(NUM_DECIMAL_PLACES);
      xml += `<c r="${colLetters[i + 2]}${rowIndex}" t="n"><v>${v}</v></c>`;
    }
  }

  xml += `</row>`;
  return xml;
};

const pushEncodedRow = (
  entry: ZipDeflate,
  rowXml: string,
  buffer: Uint8Array,
  encoder: TextEncoder,
) => {
  const { written } = encoder.encodeInto(rowXml, buffer);
  if (written < rowXml.length) {
    entry.push(encoder.encode(rowXml), false);
  } else {
    entry.push(buffer.subarray(0, written), false);
  }
};

const enc = new TextEncoder();
const encode = (str: string) => enc.encode(str);

const pushStaticEntry = (zip: Zip, name: string, content: string) => {
  const entry = new ZipDeflate(name);
  zip.add(entry);
  entry.push(encode(content), true);
};

const openSheetEntry = (zip: Zip, sheetNumber: number) => {
  const entry = new ZipDeflate(`xl/worksheets/sheet${sheetNumber}.xml`);
  zip.add(entry);
  entry.push(
    encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`,
    ),
  );
  return entry;
};

const closeSheetEntry = (entry: ZipDeflate) => {
  entry.push(encode(`</sheetData></worksheet>`), true);
};

const contentTypesXml = (sheetNames: string[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetNames.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;

const packageRelsXml = () =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const workbookXml = (sheetNames: string[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetNames.map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;

const workbookRelsXml = (sheetNames: string[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetNames.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`;

const colLetter = (colIndex: number): string => {
  let letter = "";
  let n = colIndex + 1;
  while (n > 0) {
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
};

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const formatTimestepTime = (
  timestepIndex: number,
  reportingTimeStep: number,
) => {
  const totalSeconds = timestepIndex * reportingTimeStep;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const MAX_ROWS = 1_048_575;

const METRIC_SHEET_NAMES: Record<ExportSimulationResultsProperties, string> = {
  status: "Status",
  flow: "Flow",
  velocity: "Velocity",
  unitHeadloss: "Unit Headloss",
  pressure: "Pressure",
  head: "Head",
  demand: "Demand",
  waterQuality: "Water Quality",
};

const METRICS_BY_TYPE = {
  node: new Set(["pressure", "head", "demand", "waterQuality"]),
  link: new Set(["flow", "velocity", "unitHeadloss", "status"]),
};
