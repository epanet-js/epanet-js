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
  formatOf,
  isNumeric,
  readTableFile,
  text,
  untilDoubleBlank,
  type Cell,
  type NumberedRow,
  type TableFormat,
} from "src/lib/operational-data-io/table-file";
import {
  EMPTY_VOCABULARY,
  assetTypeFor,
  parameterFor,
  type SensorParameter,
  type SensorVocabulary,
} from "./parameters";

export type ImportedSensor = {
  name: string;
  parameter: SensorParameter;
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

type HeaderKey = "sensor" | "parameter" | "asset" | "type";

const HEADER_KEYS: readonly HeaderKey[] = [
  "sensor",
  "parameter",
  "asset",
  "type",
];

const FIRST_SENSOR_COLUMN = 1;

const ANY_NODE: LabelType = "junction";
const ANY_LINK: LabelType = "pipe";

const SHAPE_ERRORS = new Set(["missingName", "noReadings", "invalidReading"]);

type ColumnError = Omit<ImportError, "row" | "label">;

type ColumnOutcome = {
  sensor?: ImportedSensor;
  errors: ColumnError[];
};

type Layout = {
  headers: Map<HeaderKey, Cell[]>;
  readingRows: NumberedRow[];
  columnCount: number;
  headerIssues: ImportError[];
};

const headerKeyOf = (cell: Cell): HeaderKey | undefined => {
  const key = text(cell).toLowerCase();
  return HEADER_KEYS.find((candidate) => candidate === key);
};

const isReadingRow = (cells: Cell[]) =>
  cells.slice(FIRST_SENSOR_COLUMN).some(isNumeric);

const readLayout = (rows: Cell[][]): Layout => {
  const body = untilDoubleBlank(rows);
  const firstReading = body.findIndex(
    ({ cells }) => !headerKeyOf(cells[0]) && isReadingRow(cells),
  );
  const headerRows = firstReading < 0 ? body : body.slice(0, firstReading);
  const readingRows = firstReading < 0 ? [] : body.slice(firstReading);

  const headers = new Map<HeaderKey, Cell[]>();
  const headerIssues: ImportError[] = [];
  for (const { cells } of headerRows) {
    const key = headerKeyOf(cells[0]);
    if (!key) {
      headerIssues.push({ code: "unknownHeaderRow" });
      continue;
    }
    if (headers.has(key)) {
      headerIssues.push({ code: "repeatedHeaderRow" });
      continue;
    }
    headers.set(key, cells);
  }

  const columnCount = Math.max(
    0,
    ...[...headers.values()].map((cells) => cells.length),
    ...readingRows.map(({ cells }) => cells.length),
  );

  return { headers, readingRows, columnCount, headerIssues };
};

const readingOf = (cell: Cell): number | null => {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  return parseDecimal(text(cell));
};

const parseReadings = (
  cells: Cell[],
): { readings: number[] } | { error: ColumnError } => {
  let last = cells.length - 1;
  while (last >= 0 && text(cells[last]) === "") last -= 1;

  if (last < 0) return { error: { code: "noReadings" } };

  const readings: number[] = [];
  for (let i = 0; i <= last; i++) {
    const value = readingOf(cells[i]);
    if (value === null) {
      return { error: { code: "invalidReading", value: text(cells[i]) } };
    }
    readings.push(value);
  }
  return { readings };
};

const assetsLabelled = (label: string, model: ModelLookup): Asset[] =>
  [
    model.labelManager.getIdByLabel(label, ANY_NODE),
    model.labelManager.getIdByLabel(label, ANY_LINK),
  ]
    .map((id) => (id === undefined ? undefined : model.assets.get(id)))
    .filter((asset): asset is Asset => asset !== undefined);

const parseColumn = (
  layout: Layout,
  column: number,
  name: string,
  model: ModelLookup,
  vocabulary: SensorVocabulary,
): ColumnOutcome => {
  const cellOf = (key: HeaderKey) => text(layout.headers.get(key)?.[column]);

  const parsedReadings = parseReadings(
    layout.readingRows.map(({ cells }) => cells[column]),
  );
  if ("error" in parsedReadings) return { errors: [parsedReadings.error] };

  const warnings: ColumnError[] = [];
  const rawAssetType = cellOf("type");
  const assetType =
    rawAssetType === "" ? undefined : assetTypeFor(rawAssetType, vocabulary);
  if (rawAssetType !== "" && !assetType) {
    warnings.push({ code: "invalidAssetType", value: rawAssetType });
  }

  const assetLabel = cellOf("asset") || name;
  const labelled = assetsLabelled(assetLabel, model);
  if (labelled.length === 0) {
    return {
      errors: [...warnings, { code: "assetNotFound", value: assetLabel }],
    };
  }

  const candidates = assetType
    ? labelled.filter((asset) => asset.type === assetType)
    : labelled;
  if (candidates.length === 0) {
    return {
      errors: [...warnings, { code: "assetTypeMismatch", value: assetLabel }],
    };
  }

  const rawParameter = cellOf("parameter");
  if (rawParameter === "") {
    return { errors: [...warnings, { code: "missingParameter" }] };
  }

  const matches = candidates.flatMap((asset) => {
    const parameter = parameterFor(asset.type, rawParameter, vocabulary);
    return parameter ? [{ asset, parameter }] : [];
  });
  if (matches.length === 0) {
    return {
      errors: [
        ...warnings,
        { code: "unsupportedParameter", value: rawParameter },
      ],
    };
  }
  if (matches.length > 1) {
    return {
      errors: [...warnings, { code: "ambiguousAsset", value: assetLabel }],
    };
  }

  const [{ asset, parameter }] = matches;
  return {
    sensor: {
      name,
      parameter,
      assetId: asset.id,
      readings: parsedReadings.readings,
    },
    errors: warnings,
  };
};

const isEmptyColumn = (layout: Layout, column: number) =>
  [...layout.headers.values(), ...layout.readingRows.map((row) => row.cells)]
    .map((cells) => text(cells[column]))
    .every((value) => value === "");

const buildSensors = (
  layout: Layout,
  model: ModelLookup,
  vocabulary: SensorVocabulary,
) => {
  const sensors: ImportedSensor[] = [];
  const errors: ImportError[] = [];
  const seenNames = new Set<string>();
  const reportedDuplicates = new Set<string>();
  const sensorsOnAssets = new Set<string>();
  const sensorRow = layout.headers.get("sensor") ?? [];
  let columnsRead = 0;
  let shapeRejects = 0;

  for (
    let column = FIRST_SENSOR_COLUMN;
    column < layout.columnCount;
    column++
  ) {
    if (isEmptyColumn(layout, column)) continue;
    columnsRead += 1;
    const position = column + 1;

    const name = text(sensorRow[column]);
    if (name === "") {
      errors.push({ code: "missingName", row: position });
      shapeRejects += 1;
      continue;
    }

    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) {
      if (!reportedDuplicates.has(nameKey)) {
        reportedDuplicates.add(nameKey);
        errors.push({ label: name, code: "duplicateName", row: position });
      }
      continue;
    }
    seenNames.add(nameKey);

    const outcome = parseColumn(layout, column, name, model, vocabulary);
    for (const error of outcome.errors) {
      errors.push({ ...error, label: name, row: position });
      if (SHAPE_ERRORS.has(error.code)) shapeRejects += 1;
    }
    if (!outcome.sensor) continue;

    const { sensor } = outcome;
    const assetKey = `${sensor.assetId}:${sensor.parameter}`;
    if (sensorsOnAssets.has(assetKey)) {
      errors.push({
        label: name,
        code: "duplicateSensorOnAsset",
        row: position,
      });
      continue;
    }
    sensorsOnAssets.add(assetKey);
    sensors.push(sensor);
  }

  return { sensors, errors, columnsRead, shapeRejects };
};

const refused = (
  format: TableFormat,
  ignored: number,
): ParseSensorDataResult => ({
  status: "error",
  format,
  sensors: [],
  ignored,
  errors: [{ code: "notAValidSensorFile" }],
});

export const parseSensorDataFile = async (
  file: File,
  model: ModelLookup,
  vocabulary: SensorVocabulary = EMPTY_VOCABULARY,
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

  const layout = readLayout(rows);
  if (!layout.headers.has("sensor")) return refused(format, 0);

  const { sensors, errors, columnsRead, shapeRejects } = buildSensors(
    layout,
    model,
    vocabulary,
  );
  const ignored = columnsRead - sensors.length;

  if (
    columnsRead === 0 ||
    (columnsRead >= 2 && shapeRejects * 2 > columnsRead)
  ) {
    return refused(format, ignored);
  }

  const allErrors = [...layout.headerIssues, ...errors];
  const status: ImportStatus =
    sensors.length === 0
      ? "error"
      : allErrors.length > 0
        ? "partial"
        : "success";

  return { status, format, sensors, ignored, errors: allErrors };
};
