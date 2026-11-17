import type {
  Asset,
  AssetId,
  AssetsMap,
  LabelManager,
  LabelType,
} from "@epanet-js/hydraulic-model";
import { parseDecimal } from "@epanet-js/i18n/numbers";
import type {
  ImportError,
  ImportStatus,
} from "src/lib/operational-data-io/import-result";
import {
  dataRowsOf,
  formatOf,
  readTableFile,
  text,
  type Cell,
  type TableFormat,
} from "src/lib/operational-data-io/table-file";
import { sensorTypeFor, type SensorType } from "./sensor-types";

export type ImportedSensor = {
  name: string;
  type: SensorType;
  assetId: AssetId;
  readings: number[];
};

export type ParseSensorDataResult = {
  status: ImportStatus;
  format?: TableFormat;
  sensors: ImportedSensor[];
  errors: ImportError[];
  ignored: number;
};

type ModelLookup = {
  labelManager: LabelManager;
  assets: AssetsMap;
};

const NAME_COLUMN = 0;
const TYPE_COLUMN = 1;
const ASSET_COLUMN = 2;
const FIRST_READING_COLUMN = 3;

const ANY_NODE: LabelType = "junction";
const ANY_LINK: LabelType = "pipe";

const SHAPE_ERRORS = new Set(["missingName", "noReadings", "invalidReading"]);

type RowOutcome =
  | { sensor: ImportedSensor }
  | { error: Omit<ImportError, "row" | "label"> };

const parseReadings = (
  cells: Cell[],
): { readings: number[] } | { error: Omit<ImportError, "row" | "label"> } => {
  let last = cells.length - 1;
  while (last >= FIRST_READING_COLUMN && text(cells[last]) === "") last -= 1;

  if (last < FIRST_READING_COLUMN) return { error: { code: "noReadings" } };

  const readings: number[] = [];
  for (let i = FIRST_READING_COLUMN; i <= last; i++) {
    const value = readingOf(cells[i]);
    if (value === null) {
      return { error: { code: "invalidReading", value: text(cells[i]) } };
    }
    readings.push(value);
  }
  return { readings };
};

const readingOf = (cell: Cell): number | null => {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  return parseDecimal(text(cell));
};

const assetsLabelled = (label: string, model: ModelLookup): Asset[] =>
  [
    model.labelManager.getIdByLabel(label, ANY_NODE),
    model.labelManager.getIdByLabel(label, ANY_LINK),
  ]
    .map((id) => (id === undefined ? undefined : model.assets.get(id)))
    .filter((asset): asset is Asset => asset !== undefined);

const parseRow = (
  cells: Cell[],
  name: string,
  model: ModelLookup,
): RowOutcome => {
  const parsedReadings = parseReadings(cells);
  if ("error" in parsedReadings) return parsedReadings;

  const assetLabel = text(cells[ASSET_COLUMN]);
  if (assetLabel === "") return { error: { code: "missingAsset" } };

  const candidates = assetsLabelled(assetLabel, model);
  if (candidates.length === 0) {
    return { error: { code: "assetNotFound", value: assetLabel } };
  }

  const rawType = text(cells[TYPE_COLUMN]);
  if (rawType === "") return { error: { code: "missingType" } };

  const matches = candidates.flatMap((asset) => {
    const type = sensorTypeFor(asset.type, rawType);
    return type ? [{ asset, type }] : [];
  });
  if (matches.length === 0) {
    return { error: { code: "unsupportedType", value: rawType } };
  }
  if (matches.length > 1) {
    return { error: { code: "ambiguousAsset", value: assetLabel } };
  }

  const [{ asset, type }] = matches;
  return {
    sensor: {
      name,
      type,
      assetId: asset.id,
      readings: parsedReadings.readings,
    },
  };
};

const buildSensors = (rows: Cell[][], model: ModelLookup) => {
  const sensors: ImportedSensor[] = [];
  const errors: ImportError[] = [];
  const seenNames = new Set<string>();
  const reportedDuplicates = new Set<string>();
  const sensorsOnAssets = new Set<string>();
  let shapeRejects = 0;

  const dataRows = dataRowsOf(rows, FIRST_READING_COLUMN);

  for (const { cells, number } of dataRows) {
    const name = text(cells[NAME_COLUMN]);
    if (name === "") {
      errors.push({ code: "missingName", row: number });
      shapeRejects += 1;
      continue;
    }

    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) {
      if (!reportedDuplicates.has(nameKey)) {
        reportedDuplicates.add(nameKey);
        errors.push({ label: name, code: "duplicateName", row: number });
      }
      continue;
    }
    seenNames.add(nameKey);

    const outcome = parseRow(cells, name, model);
    if ("error" in outcome) {
      errors.push({ ...outcome.error, label: name, row: number });
      if (SHAPE_ERRORS.has(outcome.error.code)) shapeRejects += 1;
      continue;
    }

    const { sensor } = outcome;
    const assetKey = `${sensor.assetId}:${sensor.type}`;
    if (sensorsOnAssets.has(assetKey)) {
      errors.push({
        label: name,
        code: "duplicateSensorOnAsset",
        row: number,
      });
      continue;
    }
    sensorsOnAssets.add(assetKey);
    sensors.push(sensor);
  }

  return { sensors, errors, rowCount: dataRows.length, shapeRejects };
};

export const parseSensorDataFile = async (
  file: File,
  model: ModelLookup,
): Promise<ParseSensorDataResult> => {
  const format = formatOf(file);
  if (!format) {
    return {
      status: "error",
      sensors: [],
      ignored: 0,
      errors: [{ code: "unsupportedFormat" }],
    };
  }

  let rows: Cell[][];
  try {
    rows = await readTableFile(file, format);
  } catch {
    return { status: "error", format, sensors: [], ignored: 0, errors: [] };
  }

  const { sensors, errors, rowCount, shapeRejects } = buildSensors(rows, model);
  const ignored = rowCount - sensors.length;

  if (rowCount === 0 || (rowCount >= 2 && shapeRejects * 2 > rowCount)) {
    return {
      status: "error",
      format,
      sensors: [],
      ignored,
      errors: [{ code: "notAValidSensorFile" }],
    };
  }

  const status: ImportStatus =
    sensors.length === 0 ? "error" : errors.length > 0 ? "partial" : "success";

  return { status, format, sensors, ignored, errors };
};
