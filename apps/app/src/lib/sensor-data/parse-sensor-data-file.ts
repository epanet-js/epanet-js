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
  acceptedAssetTypes,
  acceptedHeaders,
  acceptedParameters,
  headerFor,
  assetTypeFor,
  parameterFor,
  type SensorHeader,
  type SensorParameter,
  type SensorVocabulary,
} from "./parameters";

export type ImportedSensor = {
  name: string;
  parameter: SensorParameter;
  assetId: AssetId;
  times?: number[];
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

const TIME_COLUMN = 0;
const FIRST_SENSOR_COLUMN = 1;
const SECONDS_PER_DAY = 86400;

const ANY_NODE: LabelType = "junction";
const ANY_LINK: LabelType = "pipe";

const SHAPE_ERRORS = new Set(["missingName", "noReadings", "invalidReading"]);

type ColumnError = Omit<ImportError, "column" | "label">;

type ParsedColumn =
  | { times?: number[]; readings: number[]; warnings?: ColumnError[] }
  | { error: ColumnError };

type ColumnReader = {
  issues: ImportError[];
  readColumn: (column: number) => ParsedColumn;
};

type ReadingsLayout = {
  startsReadings: (cells: Cell[], isAfterHeader: boolean) => boolean;
  read: (readingRows: NumberedRow[]) => ColumnReader;
};

type ColumnOutcome = {
  sensor?: ImportedSensor;
  errors: ColumnError[];
};

type TimedRow = {
  seconds: number;
  cells: Cell[];
  number: number;
};

type Layout = {
  headers: Map<SensorHeader, Cell[]>;
  readingRows: NumberedRow[];
  columnCount: number;
  headerIssues: ImportError[];
  headerLabels: string[];
};

const headerKeyOf = (
  cell: Cell,
  vocabulary: SensorVocabulary,
): SensorHeader | undefined => headerFor(text(cell), vocabulary);

const isReadingRow = (cells: Cell[]) =>
  cells.slice(FIRST_SENSOR_COLUMN).some(isNumeric);

const HALF_DAY_SECONDS = SECONDS_PER_DAY / 2;

const CLOCK_TIME = /^(\d+):([0-5]\d)(?::([0-5]\d))?$/;
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?\s*(?:Z|[+-]\d{2}(?::?\d{2})?)?$/i;
const SLASH_DATE_TIME =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/;
const UNIX_EPOCH_AS_DATE_SERIAL = 25569;
const EARLIEST_DATE_SERIAL = 10000;

type TimeOfRow = { seconds: number; day?: number };

type SlashDate = {
  first: number;
  second: number;
  year: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type TimeProblem =
  | "missingTime"
  | "unrecognizedTime"
  | "impossibleTime"
  | "mixedDateOrder";

type CellTime = TimeOfRow | { slash: SlashDate } | { problem: TimeProblem };

const TIME_PROBLEMS: TimeProblem[] = [
  "missingTime",
  "unrecognizedTime",
  "impossibleTime",
  "mixedDateOrder",
];

type SlashOrder = "dayFirst" | "monthFirst";

const dayOf = (year: number, month: number, day: number): number | null => {
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return isReal ? date.getTime() / (SECONDS_PER_DAY * 1000) : null;
};

const datedTimeOf = (
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
): TimeOfRow | null => {
  const dayNumber = dayOf(year, month, day);
  if (dayNumber === null || hours > 23) return null;
  return { day: dayNumber, seconds: hours * 3600 + minutes * 60 + seconds };
};

const timeOfText = (raw: string): CellTime => {
  if (raw === "") return { problem: "missingTime" };

  const clock = CLOCK_TIME.exec(raw);
  if (clock) {
    const [, hours, minutes, seconds] = clock;
    return {
      seconds:
        Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds ?? 0),
    };
  }

  const iso = ISO_DATE_TIME.exec(raw);
  if (iso) {
    const [, year, month, day, hours, minutes, seconds] = iso;
    return (
      datedTimeOf(
        Number(year),
        Number(month),
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds ?? 0),
      ) ?? { problem: "impossibleTime" }
    );
  }

  const slash = SLASH_DATE_TIME.exec(raw);
  if (slash) {
    const [, first, second, year, hours, minutes, seconds] = slash;
    return {
      slash: {
        first: Number(first),
        second: Number(second),
        year: Number(year),
        hours: Number(hours),
        minutes: Number(minutes),
        seconds: Number(seconds ?? 0),
      },
    };
  }
  return { problem: "unrecognizedTime" };
};

const slashTimeOf = (date: SlashDate, order: SlashOrder): TimeOfRow | null => {
  const [day, month] =
    order === "dayFirst"
      ? [date.first, date.second]
      : [date.second, date.first];
  return datedTimeOf(
    date.year,
    month,
    day,
    date.hours,
    date.minutes,
    date.seconds,
  );
};

const largestDayStep = (dates: SlashDate[], order: SlashOrder): number => {
  const days = dates
    .map((date) => slashTimeOf(date, order)?.day)
    .filter((day): day is number => day !== undefined);
  return days.reduce(
    (largest, day, index) =>
      index === 0
        ? largest
        : Math.max(largest, Math.abs(day - days[index - 1])),
    0,
  );
};

const slashOrderOf = (dates: SlashDate[]): SlashOrder | null => {
  const isDayFirst = dates.some(
    (date) => date.first > 12 && slashTimeOf(date, "dayFirst") !== null,
  );
  const isMonthFirst = dates.some(
    (date) => date.second > 12 && slashTimeOf(date, "monthFirst") !== null,
  );
  if (isDayFirst && isMonthFirst) return null;
  if (isDayFirst) return "dayFirst";
  if (isMonthFirst) return "monthFirst";
  return largestDayStep(dates, "monthFirst") < largestDayStep(dates, "dayFirst")
    ? "monthFirst"
    : "dayFirst";
};

const timeOfNumber = (value: number): CellTime => {
  if (!Number.isFinite(value) || value < 0) {
    return { problem: "unrecognizedTime" };
  }
  const total = Math.round(value * SECONDS_PER_DAY);
  if (value < EARLIEST_DATE_SERIAL) return { seconds: total };
  return {
    day: Math.floor(total / SECONDS_PER_DAY) - UNIX_EPOCH_AS_DATE_SERIAL,
    seconds: total % SECONDS_PER_DAY,
  };
};

const timeOfCell = (cell: Cell): CellTime =>
  typeof cell === "number" ? timeOfNumber(cell) : timeOfText(text(cell));

const looksLikeTime = (cell: Cell): boolean => {
  const time = timeOfCell(cell);
  return (
    !("problem" in time) ||
    (time.problem !== "missingTime" && time.problem !== "unrecognizedTime")
  );
};

const rowsIssue = (code: string, rows: number[]): ColumnError[] =>
  rows.map((row) => ({ code, row }));

const resolvedTime = (
  time: CellTime,
  slashOrder: SlashOrder | null,
): TimeOfRow | { problem: TimeProblem } => {
  if (!("slash" in time)) return time;
  if (!slashOrder) return { problem: "mixedDateOrder" };
  return slashTimeOf(time.slash, slashOrder) ?? { problem: "impossibleTime" };
};

const readTimes = (
  rows: NumberedRow[],
): { timedRows: TimedRow[]; timeIssues: ImportError[] } => {
  const cellTimes = rows.map(({ cells }) => timeOfCell(cells[TIME_COLUMN]));
  const slashDates = cellTimes.flatMap((time) =>
    "slash" in time ? [time.slash] : [],
  );
  const slashOrder = slashDates.length > 0 ? slashOrderOf(slashDates) : null;

  const timedRows: TimedRow[] = [];
  const skipped: Record<TimeProblem, number[]> = {
    missingTime: [],
    unrecognizedTime: [],
    impossibleTime: [],
    mixedDateOrder: [],
  };
  const unordered: number[] = [];
  let firstDay: number | undefined;
  let clockDays = 0;
  let previous = -1;

  for (const [index, { cells, number }] of rows.entries()) {
    const time = resolvedTime(cellTimes[index], slashOrder);
    if ("problem" in time) {
      skipped[time.problem].push(number);
      continue;
    }

    let seconds: number;
    if (time.day !== undefined) {
      firstDay ??= time.day;
      seconds = time.seconds + (time.day - firstDay) * SECONDS_PER_DAY;
    } else {
      seconds = time.seconds + clockDays * SECONDS_PER_DAY;
      if (previous - seconds > HALF_DAY_SECONDS) {
        clockDays += 1;
        seconds += SECONDS_PER_DAY;
      }
    }

    if (seconds <= previous) {
      unordered.push(number);
      continue;
    }
    previous = seconds;
    timedRows.push({ seconds, cells, number });
  }

  return {
    timedRows,
    timeIssues: [
      ...TIME_PROBLEMS.flatMap((problem) =>
        rowsIssue(problem, skipped[problem]),
      ),
      ...rowsIssue("timeNotIncreasing", unordered),
    ],
  };
};

const readLayout = (
  rows: Cell[][],
  vocabulary: SensorVocabulary,
  startsReadings: ReadingsLayout["startsReadings"],
): Layout => {
  const body = untilDoubleBlank(rows);
  let isAfterHeader = false;
  const firstReading = body.findIndex(({ cells }) => {
    if (headerKeyOf(cells[0], vocabulary)) {
      isAfterHeader = true;
      return false;
    }
    return startsReadings(cells, isAfterHeader);
  });
  const headerRows = firstReading < 0 ? body : body.slice(0, firstReading);
  const readingRows = firstReading < 0 ? [] : body.slice(firstReading);

  const headers = new Map<SensorHeader, Cell[]>();
  const headerIssues: ImportError[] = [];
  for (const { cells } of headerRows) {
    const key = headerKeyOf(cells[0], vocabulary);
    if (!key) {
      headerIssues.push({
        code: "unknownHeaderRow",
        params: [text(cells[0]), acceptedHeaders(vocabulary).join(", ")],
      });
      continue;
    }
    if (headers.has(key)) {
      headerIssues.push({
        code: "repeatedHeaderRow",
        params: [text(cells[0])],
      });
      continue;
    }
    headers.set(key, cells);
  }

  const columnCount = Math.max(
    0,
    ...[...headers.values()].map((cells) => cells.length),
    ...readingRows.map(({ cells }) => cells.length),
  );

  const headerLabels = headerRows
    .map(({ cells }) => text(cells[0]))
    .filter((label) => label !== "");

  return { headers, readingRows, columnCount, headerIssues, headerLabels };
};

const readingOf = (cell: Cell): number | null => {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  return parseDecimal(text(cell));
};

const parseReadingsByIndex = (
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

const parseReadings = (rows: TimedRow[], column: number): ParsedColumn => {
  const times: number[] = [];
  const readings: number[] = [];
  const notNumbers: number[] = [];
  for (const { seconds, cells, number } of rows) {
    const cell = cells[column];
    if (text(cell) === "") continue;
    const value = readingOf(cell);
    if (value === null) {
      notNumbers.push(number);
      continue;
    }
    times.push(seconds);
    readings.push(value);
  }

  if (readings.length === 0) return { error: { code: "noReadings" } };
  return {
    times,
    readings,
    warnings: rowsIssue("readingNotANumber", notNumbers),
  };
};

const BY_INDEX: ReadingsLayout = {
  startsReadings: isReadingRow,
  read: (readingRows) => ({
    issues: [],
    readColumn: (column) =>
      parseReadingsByIndex(readingRows.map(({ cells }) => cells[column])),
  }),
};

const BY_TIME: ReadingsLayout = {
  startsReadings: (cells, isAfterHeader) =>
    isReadingRow(cells) || (isAfterHeader && looksLikeTime(cells[TIME_COLUMN])),
  read: (readingRows) => {
    const { timedRows, timeIssues } = readTimes(readingRows);
    return {
      issues: timeIssues,
      readColumn: (column) => parseReadings(timedRows, column),
    };
  },
};

const acceptedParametersFor = (
  assets: Asset[],
  vocabulary: SensorVocabulary,
): string =>
  [...new Set(assets.map(({ type }) => type))]
    .map(
      (type) => `${type}: ${acceptedParameters(type, vocabulary).join(", ")}`,
    )
    .join("; ");

const assetsLabelled = (label: string, model: ModelLookup): Asset[] =>
  [
    model.labelManager.getIdByLabel(label, ANY_NODE),
    model.labelManager.getIdByLabel(label, ANY_LINK),
  ]
    .map((id) => (id === undefined ? undefined : model.assets.get(id)))
    .filter((asset): asset is Asset => asset !== undefined);

const parseColumn = (
  layout: Layout,
  reader: ColumnReader,
  column: number,
  name: string,
  model: ModelLookup,
  vocabulary: SensorVocabulary,
): ColumnOutcome => {
  const cellOf = (key: SensorHeader) => text(layout.headers.get(key)?.[column]);

  const parsedReadings = reader.readColumn(column);
  if ("error" in parsedReadings) return { errors: [parsedReadings.error] };

  const warnings: ColumnError[] = [...(parsedReadings.warnings ?? [])];
  const rawAssetType = cellOf("type");
  const assetType =
    rawAssetType === "" ? undefined : assetTypeFor(rawAssetType, vocabulary);
  if (rawAssetType !== "" && !assetType) {
    warnings.push({
      code: "invalidAssetType",
      params: [acceptedAssetTypes(vocabulary).join(", ")],
      value: rawAssetType,
    });
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
        {
          code: "unsupportedParameter",
          params: [acceptedParametersFor(candidates, vocabulary)],
          value: rawParameter,
        },
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
      ...(parsedReadings.times ? { times: parsedReadings.times } : {}),
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
  reader: ColumnReader,
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
      errors.push({ code: "missingName", column: position });
      shapeRejects += 1;
      continue;
    }

    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) {
      if (!reportedDuplicates.has(nameKey)) {
        reportedDuplicates.add(nameKey);
        errors.push({ label: name, code: "duplicateName", column: position });
      }
      continue;
    }
    seenNames.add(nameKey);

    const outcome = parseColumn(
      layout,
      reader,
      column,
      name,
      model,
      vocabulary,
    );
    for (const error of outcome.errors) {
      errors.push({ ...error, label: name, column: position });
      if (SHAPE_ERRORS.has(error.code)) shapeRejects += 1;
    }
    if (!outcome.sensor) continue;

    const { sensor } = outcome;
    const assetKey = `${sensor.assetId}:${sensor.parameter}`;
    if (sensorsOnAssets.has(assetKey)) {
      errors.push({
        label: name,
        code: "duplicateSensorOnAsset",
        column: position,
      });
      continue;
    }
    sensorsOnAssets.add(assetKey);
    sensors.push(sensor);
  }

  return { sensors, errors, columnsRead, shapeRejects };
};

const MAX_LISTED_LABELS = 5;

const refused = (
  format: TableFormat,
  ignored: number,
  error: ImportError = { code: "notAValidSensorFile" },
): ParseSensorDataResult => ({
  status: "error",
  format,
  sensors: [],
  ignored,
  errors: [error],
});

const missingSensorRow = (layout: Layout): ImportError | undefined => {
  if (layout.headerLabels.length === 0) return undefined;
  const listed = layout.headerLabels.slice(0, MAX_LISTED_LABELS).join(", ");
  return { code: "missingSensorRow", params: [listed] };
};

export const parseSensorDataFile = (
  file: File,
  model: ModelLookup,
  vocabulary: SensorVocabulary = EMPTY_VOCABULARY,
): Promise<ParseSensorDataResult> =>
  parseWith(file, model, vocabulary, BY_INDEX);

export const parseSensorTimeSeriesFile = (
  file: File,
  model: ModelLookup,
  vocabulary: SensorVocabulary = EMPTY_VOCABULARY,
): Promise<ParseSensorDataResult> =>
  parseWith(file, model, vocabulary, BY_TIME);

const parseWith = async (
  file: File,
  model: ModelLookup,
  vocabulary: SensorVocabulary,
  readings: ReadingsLayout,
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

  const layout = readLayout(rows, vocabulary, readings.startsReadings);
  if (!layout.headers.has("sensor")) {
    return refused(format, 0, missingSensorRow(layout));
  }

  const reader = readings.read(layout.readingRows);
  const { sensors, errors, columnsRead, shapeRejects } = buildSensors(
    layout,
    reader,
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

  const allErrors = [...layout.headerIssues, ...reader.issues, ...errors];
  const status: ImportStatus =
    sensors.length === 0
      ? "error"
      : allErrors.length > 0
        ? "partial"
        : "success";

  return { status, format, sensors, ignored, errors: allErrors };
};
