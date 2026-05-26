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
  fileHandle: FileSystemFileHandle,
  hydraulicModel: HydraulicModel,
  resultsReader: EPSResultsReader,
  options?: SimulationResultsOptions,
) => {
  const selectedAssets = options?.selectedAssets ?? new Set<number>();
  const properties = options?.properties ?? ALL_METRICS;
  const onProgress = options?.onProgress;
  const signal = options?.signal;

  signal?.throwIfAborted();

  const sheetNames = properties.map((m) => METRIC_SHEET_NAMES[m]);
  const stream = await fileHandle.createWritable();

  const numTimestepCols = resultsReader.timestepCount;
  const totalCols = 2 + numTimestepCols;

  const colLetters: string[] = new Array(totalCols);
  for (let i = 0; i < totalCols; i++) {
    colLetters[i] = colLetter(i);
  }

  const colLetterBytes: Uint8Array[] = colLetters.map((l) => encode(l));

  const XML_ROW_OPEN = encode('<row r="');
  const XML_TAG_CLOSE = encode('">');
  const XML_CELL_OPEN = encode('<c r="');
  const XML_INLINE_STR_MID = encode('" t="inlineStr"><is><t>');
  const XML_INLINE_STR_END = encode("</t></is></c>");
  const XML_NUM_MID = encode('" t="n"><v>');
  const XML_NUM_END = encode("</v></c>");
  const XML_ROW_CLOSE = encode("</row>");
  const XML_CLOSED = encode("closed");
  const XML_OPEN = encode("open");

  const headerRowXml = buildHeaderRowXml(
    resultsReader.timestepCount,
    resultsReader.reportingTimeStep,
    colLetters,
  );

  const BATCH_SIZE = 128 * 1024;
  const rowBufferSize = Math.max(64 * 1024, totalCols * 50);
  const batchBuffer = new Uint8Array(
    Math.max(rowBufferSize * 2, BATCH_SIZE * 2),
  );
  let batchOffset = 0;

  const encodeIntoBatch = (xml: string): number => {
    const view = batchBuffer.subarray(batchOffset);
    const { written } = encoder.encodeInto(xml, view);
    if (written < xml.length) {
      const full = encoder.encode(xml);
      batchBuffer.set(full, batchOffset);
      return batchOffset + full.length;
    }
    return batchOffset + written;
  };

  const flushBatch = (entry: ZipDeflate) => {
    if (batchOffset > 0) {
      entry.push(batchBuffer.subarray(0, batchOffset), false);
      batchOffset = 0;
    }
  };

  const writeBuf = (buf: Uint8Array) => {
    batchBuffer.set(buf, batchOffset);
    batchOffset += buf.length;
  };

  const writeAsciiStr = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      batchBuffer[batchOffset++] = s.charCodeAt(i);
    }
  };

  const writeXmlEscaped = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i);
      if (ch === UTF8_AMPERSAND) {
        batchBuffer[batchOffset++] = UTF8_AMPERSAND;
        batchBuffer[batchOffset++] = UTF8_a;
        batchBuffer[batchOffset++] = UTF8_m;
        batchBuffer[batchOffset++] = UTF8_p;
        batchBuffer[batchOffset++] = UTF8_SEMICOLON;
      } else if (ch === UTF8_LESS_THAN) {
        batchBuffer[batchOffset++] = UTF8_AMPERSAND;
        batchBuffer[batchOffset++] = UTF8_l;
        batchBuffer[batchOffset++] = UTF8_t;
        batchBuffer[batchOffset++] = UTF8_SEMICOLON;
      } else if (ch === UTF8_GREATER_THAN) {
        batchBuffer[batchOffset++] = UTF8_AMPERSAND;
        batchBuffer[batchOffset++] = UTF8_g;
        batchBuffer[batchOffset++] = UTF8_t;
        batchBuffer[batchOffset++] = UTF8_SEMICOLON;
      } else if (ch === UTF8_DOUBLE_QUOTE) {
        batchBuffer[batchOffset++] = UTF8_AMPERSAND;
        batchBuffer[batchOffset++] = UTF8_q;
        batchBuffer[batchOffset++] = UTF8_u;
        batchBuffer[batchOffset++] = UTF8_o;
        batchBuffer[batchOffset++] = UTF8_t;
        batchBuffer[batchOffset++] = UTF8_SEMICOLON;
      } else if (ch === UTF8_SINGLE_QUOTE) {
        batchBuffer[batchOffset++] = UTF8_AMPERSAND;
        batchBuffer[batchOffset++] = UTF8_a;
        batchBuffer[batchOffset++] = UTF8_p;
        batchBuffer[batchOffset++] = UTF8_o;
        batchBuffer[batchOffset++] = UTF8_s;
        batchBuffer[batchOffset++] = UTF8_SEMICOLON;
      } else {
        batchBuffer[batchOffset++] = ch;
      }
    }
  };

  const writeNumber = (n: number) => {
    const s = Math.trunc(n) === n ? String(n) : n.toFixed(NUM_DECIMAL_PLACES);
    for (let i = 0; i < s.length; i++) {
      batchBuffer[batchOffset++] = s.charCodeAt(i);
    }
  };

  const writeDataRow = (
    rowIndex: number,
    label: string,
    assetType: string,
    values: Float32Array,
    metric: ExportSimulationResultsProperties,
  ) => {
    const rowStr = String(rowIndex);

    writeBuf(XML_ROW_OPEN);
    writeAsciiStr(rowStr);
    writeBuf(XML_TAG_CLOSE);

    writeBuf(XML_CELL_OPEN);
    writeBuf(colLetterBytes[0]);
    writeAsciiStr(rowStr);
    writeBuf(XML_INLINE_STR_MID);
    writeXmlEscaped(label);
    writeBuf(XML_INLINE_STR_END);

    writeBuf(XML_CELL_OPEN);
    writeBuf(colLetterBytes[1]);
    writeAsciiStr(rowStr);
    writeBuf(XML_INLINE_STR_MID);
    writeAsciiStr(assetType);
    writeBuf(XML_INLINE_STR_END);

    if (metric === "status") {
      for (let i = 0; i < values.length; i++) {
        writeBuf(XML_CELL_OPEN);
        writeBuf(colLetterBytes[i + 2]);
        writeAsciiStr(rowStr);
        writeBuf(XML_INLINE_STR_MID);
        writeBuf(values[i] < 3 ? XML_CLOSED : XML_OPEN);
        writeBuf(XML_INLINE_STR_END);
      }
    } else {
      for (let i = 0; i < values.length; i++) {
        writeBuf(XML_CELL_OPEN);
        writeBuf(colLetterBytes[i + 2]);
        writeAsciiStr(rowStr);
        writeBuf(XML_NUM_MID);
        writeNumber(values[i]);
        writeBuf(XML_NUM_END);
      }
    }

    writeBuf(XML_ROW_CLOSE);
  };

  const hasSelection = selectedAssets.size > 0;
  const totalProgress = properties.length * hydraulicModel.assets.size;
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
          properties,
          async (metric, asset, results) => {
            if (onProgress) {
              await onProgress(
                Math.trunc((progress++ / totalProgress) * 100),
                metric as ExportSimulationResultsProperties,
              );
            }

            if (metric !== currentMetric) {
              if (currentEntry) {
                flushBatch(currentEntry);
                closeSheetEntry(currentEntry);
              }
              const sheetIndex = properties.indexOf(
                metric as ExportSimulationResultsProperties,
              );
              currentEntry = openSheetEntry(zip, sheetIndex + 1);
              batchOffset = encodeIntoBatch(headerRowXml);
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

            writeDataRow(
              rowCount,
              asset.label,
              asset.type,
              results.values,
              metric as ExportSimulationResultsProperties,
            );

            if (batchOffset >= BATCH_SIZE) {
              flushBatch(currentEntry!);
            }
          },
          signal,
        );

        iterationPromise
          .then(() => {
            if (currentEntry) {
              flushBatch(currentEntry);
              closeSheetEntry(currentEntry);
            }

            for (let i = 0; i < properties.length; i++) {
              if (!writtenMetrics.has(properties[i])) {
                const entry = openSheetEntry(zip, i + 1);
                batchOffset = encodeIntoBatch(headerRowXml);
                flushBatch(entry);
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
    const fileName = `${networkName}-export.xlsx`;
    await FileSystemHelpers.triggerDownload(fileName, fileHandle);
  }
};

const UTF8_AMPERSAND = 38;
const UTF8_SEMICOLON = 59;
const UTF8_LESS_THAN = 60;
const UTF8_GREATER_THAN = 62;
const UTF8_DOUBLE_QUOTE = 34;
const UTF8_SINGLE_QUOTE = 39;
const UTF8_a = 97;
const UTF8_g = 103;
const UTF8_l = 108;
const UTF8_m = 109;
const UTF8_o = 111;
const UTF8_p = 112;
const UTF8_q = 113;
const UTF8_s = 115;
const UTF8_t = 116;
const UTF8_u = 117;

const encoder = new TextEncoder();
const encode = (str: string) => encoder.encode(str);

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

const pushStaticEntry = (zip: Zip, name: string, content: string) => {
  const entry = new ZipDeflate(name, { level: 0 });
  zip.add(entry);
  entry.push(encode(content), true);
};

const openSheetEntry = (zip: Zip, sheetNumber: number) => {
  const entry = new ZipDeflate(`xl/worksheets/sheet${sheetNumber}.xml`, {
    level: 0,
  });
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
