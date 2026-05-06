import { Zip, ZipDeflate } from "fflate";
import { Asset, HydraulicModel } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation";
import { ExportedAssetTypes } from "../types";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { FILE_NAMES } from "./constants";

const MAX_ROWS = 1_048_575;

const ASSET_TYPES: Exclude<ExportedAssetTypes, "customerPoint">[] = [
  "junction",
  "reservoir",
  "tank",
  "pipe",
  "pump",
  "valve",
];

const SHEET_NAMES = [
  ...ASSET_TYPES.map((t) => FILE_NAMES[t]),
  FILE_NAMES["customerPoint"],
];

export const exportXlsx = async (
  handle: FileSystemFileHandle,
  hydraulicModel: HydraulicModel,
  includeSimulationResults: boolean,
  selectedAssets: Set<number>,
  resultsReader?: ResultsReader,
): Promise<void> => {
  const stream = await handle.createWritable();

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
        pushStaticEntry(zip, "[Content_Types].xml", contentTypesXml());
        pushStaticEntry(zip, "_rels/.rels", packageRelsXml());
        pushStaticEntry(zip, "xl/workbook.xml", workbookXml());
        pushStaticEntry(zip, "xl/_rels/workbook.xml.rels", workbookRelsXml());

        const getSimResults = buildSimulationResultsReader(resultsReader);
        const hasSelection = selectedAssets.size > 0;

        for (const [sheetIndex, assetType] of ASSET_TYPES.entries()) {
          const sheetEntry = openSheetEntry(zip, sheetIndex + 1);
          let headerWritten = false;
          let rowCount = 0;

          hydraulicModel.assets.forEach((asset) => {
            if (asset.type !== assetType) return;
            if (hasSelection && !selectedAssets.has(asset.id)) return;

            const simValues = includeSimulationResults
              ? (getSimResults[assetType](asset) as Record<string, unknown>)
              : {};

            if (!headerWritten) {
              pushRow(sheetEntry, 1, buildHeader(asset, simValues));
              headerWritten = true;
              rowCount = 1;
            }

            if (rowCount >= MAX_ROWS) {
              throw new Error(
                `Sheet exceeds Excel's ${MAX_ROWS.toLocaleString()} row limit`,
              );
            }

            pushRow(
              sheetEntry,
              ++rowCount,
              buildRow(asset, simValues, hydraulicModel),
            );
          });

          closeSheetEntry(sheetEntry);
        }

        const customerSheetEntry = openSheetEntry(zip, ASSET_TYPES.length + 1);
        pushRow(customerSheetEntry, 1, CUSTOMER_POINT_HEADERS);
        let customerRowCount = 1;

        hydraulicModel.customerPoints.forEach((point) => {
          if (customerRowCount >= MAX_ROWS) {
            throw new Error(
              `Sheet exceeds Excel's ${MAX_ROWS.toLocaleString()} row limit`,
            );
          }
          pushRow(
            customerSheetEntry,
            ++customerRowCount,
            buildCustomerPointRow(point, hydraulicModel),
          );
        });

        closeSheetEntry(customerSheetEntry);
        zip.end();
      } catch (err) {
        reject(err);
      }
    });

    await stream.close();
  } catch (err) {
    await stream.abort();
    throw err;
  }
};

const CUSTOMER_POINT_HEADERS = [
  "label",
  "positionX",
  "positionY",
  "junctionConnection",
  "pipeConnection",
  "connectionX",
  "connectionY",
];

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

const pushRow = (entry: ZipDeflate, rowIndex: number, values: unknown[]) => {
  const cells = values
    .map((value, colIndex) => cellXml(colIndex, rowIndex, value))
    .join("");
  entry.push(encode(`<row r="${rowIndex}">${cells}</row>`));
};

const cellXml = (
  colIndex: number,
  rowIndex: number,
  value: unknown,
): string => {
  const ref = `${colLetter(colIndex)}${rowIndex}`;
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number")
    return `<c r="${ref}" t="n"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
};

const contentTypesXml = () =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${SHEET_NAMES.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;

const packageRelsXml = () =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const workbookXml = () =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${SHEET_NAMES.map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;

const workbookRelsXml = () =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${SHEET_NAMES.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`;

const buildSimulationResultsReader = (resultsReader?: ResultsReader) => {
  if (!resultsReader) {
    return {
      junction: () => ({}),
      tank: () => ({}),
      reservoir: () => ({}),
      pipe: () => ({}),
      pump: () => ({}),
      valve: () => ({}),
    };
  }

  return {
    junction: (asset: Asset) => resultsReader.getJunction(asset.id) ?? {},
    tank: (asset: Asset) => resultsReader.getTank(asset.id) ?? {},
    reservoir: (asset: Asset) => resultsReader.getReservoir(asset.id) ?? {},
    pipe: (asset: Asset) => resultsReader.getPipe(asset.id) ?? {},
    pump: (asset: Asset) => resultsReader.getPump(asset.id) ?? {},
    valve: (asset: Asset) => resultsReader.getValve(asset.id) ?? {},
  };
};

const buildHeader = (
  asset: Asset,
  simValues: Record<string, unknown>,
): string[] => {
  const propertyKeys = asset.listProperties();
  if (asset.isNode) propertyKeys.unshift("positionX", "positionY");

  const simKeys = new Set(Object.keys(simValues).map((k) => `sim_${k}`));
  simKeys.delete("sim_type");

  const headers: string[] = [];
  for (const key of propertyKeys) {
    if (key === "connections") {
      headers.push("startNode", "endNode");
    } else {
      headers.push(key);
    }
  }
  for (const key of simKeys) {
    headers.push(key);
  }
  return headers;
};

const buildRow = (
  asset: Asset,
  simValues: Record<string, unknown>,
  hydraulicModel: HydraulicModel,
): unknown[] => {
  const propertyKeys = asset.listProperties();
  if (asset.isNode) propertyKeys.unshift("positionX", "positionY");

  const simKeys = new Set(Object.keys(simValues).map((k) => `sim_${k}`));
  simKeys.delete("sim_type");

  const row: unknown[] = [];

  for (const key of propertyKeys) {
    if (key === "positionX") {
      row.push((asset.coordinates as number[])[0]);
    } else if (key === "positionY") {
      row.push((asset.coordinates as number[])[1]);
    } else if (key === "connections") {
      const [startId, endId] = asset.getProperty(
        "connections",
      ) as unknown as number[];
      row.push(
        hydraulicModel.assets.get(startId)?.label ?? "",
        hydraulicModel.assets.get(endId)?.label ?? "",
      );
    } else {
      const value = asset.getProperty(key);
      row.push(typeof value === "object" && value !== null ? "" : value);
    }
  }

  for (const key of simKeys) {
    row.push(simValues[key.slice(4)]);
  }

  return row;
};

const buildCustomerPointRow = (
  point: CustomerPoint,
  hydraulicModel: HydraulicModel,
): unknown[] => {
  const junctionConnection =
    point.connection !== null
      ? (hydraulicModel.assets.get(point.connection.junctionId)?.label ?? "")
      : "";
  const pipeConnection =
    point.connection !== null
      ? (hydraulicModel.assets.get(point.connection.pipeId)?.label ?? "")
      : "";

  return [
    point.label,
    point.coordinates[0],
    point.coordinates[1],
    junctionConnection,
    pipeConnection,
    point.connection?.snapPoint[0] ?? "",
    point.connection?.snapPoint[1] ?? "",
  ];
};

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
