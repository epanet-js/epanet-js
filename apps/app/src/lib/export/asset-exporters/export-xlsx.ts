import { Zip, ZipDeflate } from "fflate";
import { TranslateFn } from "@epanet-js/i18n";
import { Asset, HydraulicModel, Projection } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation";
import { AssetExportOptions, ExportedAssetTypes } from "../types";
import { CustomerPoint } from "@epanet-js/hydraulic-model";
import { FILE_NAMES } from "./constants";
import { NUM_DECIMAL_PLACES, COORDINATE_DECIMAL_PLACES } from "../constants";
import { createProjectionMapper } from "src/lib/projections";
import { resolveExportValue } from "./optional-field-defaults";
import { exportableProperties } from "./excluded-fields";
import {
  buildPropertyNameResolver,
  PropertyNameResolver,
} from "./property-names";
import { Position } from "geojson";

const MAX_ROWS = 1_048_575;

const ALL_ASSET_TYPES: Exclude<ExportedAssetTypes, "customerPoint">[] = [
  "junction",
  "reservoir",
  "tank",
  "pipe",
  "pump",
  "valve",
];

export const exportXlsx = async (
  handle: FileSystemFileHandle,
  hydraulicModel: HydraulicModel,
  projection: Projection,
  translate: TranslateFn,
  options?: AssetExportOptions,
): Promise<void> => {
  const includeSimulationResults =
    (options?.includeSimulationResults ?? false) && !!options?.resultsReader;
  const selectedAssets = options?.assetIdsFilter ?? null;
  const selectedCustomerPoints = options?.customerPointIdFilter ?? null;
  const resultsReader = options?.resultsReader;

  const assetTypeCounts = new Map<string, number>();
  hydraulicModel.assets.forEach((asset) => {
    if (selectedAssets && !selectedAssets.has(asset.id)) return;
    assetTypeCounts.set(asset.type, (assetTypeCounts.get(asset.type) ?? 0) + 1);
  });
  const customerPointCount = selectedCustomerPoints
    ? selectedCustomerPoints.size
    : hydraulicModel.customerPoints.size;

  const activeAssetTypes = ALL_ASSET_TYPES.filter(
    (t) => (assetTypeCounts.get(t) ?? 0) > 0,
  );
  const hasCustomerPoints = customerPointCount > 0;

  const sheetTypes: ExportedAssetTypes[] = [
    ...activeAssetTypes,
    ...(hasCustomerPoints ? (["customerPoint"] as const) : []),
  ];
  const sheetNames = buildSheetNames(sheetTypes, translate);

  if (sheetNames.length === 0) return;

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

        const transformCoord = createProjectionMapper(projection).toSource;
        const getSimResults = buildSimulationResultsReader(resultsReader);
        const resolvePropertyName = buildPropertyNameResolver(
          hydraulicModel.customAttributes,
          translate,
        );

        for (const [sheetIndex, assetType] of activeAssetTypes.entries()) {
          const sheetEntry = openSheetEntry(zip, sheetIndex + 1);
          let headerWritten = false;
          let rowCount = 0;

          hydraulicModel.assets.forEach((asset) => {
            if (asset.type !== assetType) return;
            if (selectedAssets && !selectedAssets.has(asset.id)) return;

            const simValues = includeSimulationResults
              ? (getSimResults[assetType](asset) as Record<string, unknown>)
              : {};

            if (!headerWritten) {
              pushRow(
                sheetEntry,
                1,
                buildHeader(asset, simValues, resolvePropertyName),
              );
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
              buildRow(asset, simValues, hydraulicModel, transformCoord),
            );
          });

          closeSheetEntry(sheetEntry);
        }

        if (hasCustomerPoints) {
          const customerSheetEntry = openSheetEntry(
            zip,
            activeAssetTypes.length + 1,
          );
          pushRow(
            customerSheetEntry,
            1,
            CUSTOMER_POINT_HEADERS.map((key) =>
              resolvePropertyName("customerPoint", key),
            ),
          );
          let customerRowCount = 1;

          hydraulicModel.customerPoints.forEach((point) => {
            if (selectedCustomerPoints && !selectedCustomerPoints.has(point.id))
              return;
            if (customerRowCount >= MAX_ROWS) {
              throw new Error(
                `Sheet exceeds Excel's ${MAX_ROWS.toLocaleString()} row limit`,
              );
            }
            pushRow(
              customerSheetEntry,
              ++customerRowCount,
              buildCustomerPointRow(point, hydraulicModel, transformCoord),
            );
          });

          closeSheetEntry(customerSheetEntry);
        }

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

const XLSX_SHEET_NAME_MAX_LENGTH = 31;
const INVALID_SHEET_NAME_CHARS = /[\\/?*[\]:]/g;

const SHEET_NAME_KEYS: Record<ExportedAssetTypes, string> = {
  junction: "junctions",
  reservoir: "reservoirs",
  tank: "tanks",
  pipe: "pipes",
  pump: "pumps",
  valve: "valves",
  customerPoint: "customerPoints",
};

const buildSheetNames = (
  types: ExportedAssetTypes[],
  translate: TranslateFn,
): string[] => {
  const usedNames = new Set<string>();
  return types.map((type) => {
    const base =
      translate(SHEET_NAME_KEYS[type])
        .replace(INVALID_SHEET_NAME_CHARS, " ")
        .trim()
        .slice(0, XLSX_SHEET_NAME_MAX_LENGTH) || FILE_NAMES[type];

    let candidate = base;
    for (let suffix = 2; usedNames.has(candidate); suffix++) {
      const digits = ` ${suffix}`;
      candidate =
        base.slice(0, XLSX_SHEET_NAME_MAX_LENGTH - digits.length) + digits;
    }
    usedNames.add(candidate);
    return candidate;
  });
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
  if (typeof value === "number") {
    const numberValue =
      Math.trunc(value) === value ? value : value.toFixed(NUM_DECIMAL_PLACES);
    return `<c r="${ref}" t="n"><v>${numberValue}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
};

const contentTypesXml = (sheetNames: string[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetNames.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;

const packageRelsXml = () =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const workbookXml = (sheetNames: string[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetNames.map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;

const workbookRelsXml = (sheetNames: string[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetNames.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`;

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
  resolvePropertyName: PropertyNameResolver,
): string[] => {
  const propertyKeys = exportableProperties(asset.type, asset.listProperties());
  if (asset.isNode) propertyKeys.unshift("positionX", "positionY");

  const simKeys = new Set(Object.keys(simValues).map((k) => `sim_${k}`));
  simKeys.delete("sim_type");

  const headers: string[] = [];
  for (const key of propertyKeys) {
    if (key === "connections") {
      headers.push(
        resolvePropertyName(asset.type, "startNode"),
        resolvePropertyName(asset.type, "endNode"),
      );
    } else {
      headers.push(resolvePropertyName(asset.type, key));
    }
  }
  for (const key of simKeys) {
    headers.push(resolvePropertyName(asset.type, key));
  }
  return headers;
};

const buildRow = (
  asset: Asset,
  simValues: Record<string, unknown>,
  hydraulicModel: HydraulicModel,
  transformCoord: (p: Position) => Position,
): unknown[] => {
  const propertyKeys = exportableProperties(asset.type, asset.listProperties());
  if (asset.isNode) propertyKeys.unshift("positionX", "positionY");

  const simKeys = new Set(Object.keys(simValues).map((k) => `sim_${k}`));
  simKeys.delete("sim_type");

  const row: unknown[] = [];

  for (const key of propertyKeys) {
    if (key === "positionX") {
      row.push(
        transformCoord(asset.coordinates as Position)[0].toFixed(
          COORDINATE_DECIMAL_PLACES,
        ),
      );
    } else if (key === "positionY") {
      row.push(
        transformCoord(asset.coordinates as Position)[1].toFixed(
          COORDINATE_DECIMAL_PLACES,
        ),
      );
    } else if (key === "connections") {
      const [startId, endId] = asset.getProperty(
        "connections",
      ) as unknown as number[];
      row.push(
        hydraulicModel.assets.get(startId)?.label ?? "",
        hydraulicModel.assets.get(endId)?.label ?? "",
      );
    } else {
      const value = resolveExportValue(asset.type, key, asset.getProperty(key));
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
  transformCoord: (p: Position) => Position,
): unknown[] => {
  const junctionConnection =
    point.connection !== null
      ? (hydraulicModel.assets.get(point.connection.junctionId)?.label ?? "")
      : "";
  const pipeConnection =
    point.connection !== null
      ? (hydraulicModel.assets.get(point.connection.pipeId)?.label ?? "")
      : "";
  const [x, y] = transformCoord(point.coordinates);
  const snapPoint = point.connection?.snapPoint;
  const snapCoords = snapPoint ? transformCoord(snapPoint) : null;
  const sx = snapCoords ? snapCoords[0].toFixed(COORDINATE_DECIMAL_PLACES) : "";
  const sy = snapCoords ? snapCoords[1].toFixed(COORDINATE_DECIMAL_PLACES) : "";

  return [
    point.label,
    x.toFixed(COORDINATE_DECIMAL_PLACES),
    y.toFixed(COORDINATE_DECIMAL_PLACES),
    junctionConnection,
    pipeConnection,
    sx,
    sy,
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
