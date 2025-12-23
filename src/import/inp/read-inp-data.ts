import { InpData, InpStats, nullInpData } from "./inp-data";
import { IssuesAccumulator } from "./issues";
import { ParseInpOptions } from "./parse-inp";
import {
  RowParser,
  ignore,
  parseDemand,
  parseJunction,
  parseOption,
  parsePattern,
  parsePipe,
  parsePosition,
  parseReservoir,
  parseTank,
  parseVertex,
  parsePump,
  parseCurve,
  parseStatus,
  parseValve,
  unsupported,
  parseTimeSetting,
  parseControl,
  parseRule,
  parseEnergy,
  parseEmitter,
  parseReaction,
} from "./row-parsers";
import { MAX_CUSTOMER_POINT_LABEL_LENGTH } from "src/hydraulic-model/customer-points";

const commentIdentifier = ";";

type SectionParsers = Record<string, RowParser>;

type SectionParserDefinition = {
  names: string[];
  parser: RowParser;
};

const buildSectionParserDefinitions = (): SectionParserDefinition[] => [
  { names: ["TITLE"], parser: ignore },
  { names: ["CURVES", "CURVE"], parser: parseCurve },
  { names: ["QUALITY"], parser: unsupported },
  { names: ["OPTIONS"], parser: parseOption },
  { names: ["BACKDROP"], parser: ignore },
  { names: ["JUNCTIONS", "JUNCTION"], parser: parseJunction },
  { names: ["PATTERNS", "PATTERN"], parser: parsePattern },
  { names: ["REACTIONS"], parser: parseReaction },
  { names: ["TIMES"], parser: parseTimeSetting },
  { names: ["COORDINATES", "COORDINATE"], parser: parsePosition },
  { names: ["RESERVOIRS", "RESERVOIR"], parser: parseReservoir },
  { names: ["ENERGY"], parser: parseEnergy },
  { names: ["SOURCES"], parser: unsupported },
  { names: ["REPORT"], parser: ignore },
  { names: ["VERTICES", "VERTEX"], parser: parseVertex },
  { names: ["TANKS", "TANK"], parser: parseTank },
  { names: ["STATUS"], parser: parseStatus },
  { names: ["MIXING"], parser: unsupported },
  { names: ["LABELS"], parser: unsupported },
  { names: ["PIPES", "PIPE"], parser: parsePipe },
  { names: ["CONTROLS"], parser: parseControl },
  { names: ["PUMPS", "PUMP"], parser: parsePump },
  { names: ["RULES"], parser: parseRule },
  { names: ["VALVES", "VALVE"], parser: parseValve },
  { names: ["DEMANDS", "DEMAND"], parser: parseDemand },
  { names: ["EMITTERS"], parser: parseEmitter },
  { names: ["TAGS"], parser: unsupported },
];

const buildSectionParsers = (): SectionParsers => {
  const definitions = buildSectionParserDefinitions();
  const result: SectionParsers = {};

  definitions.forEach(({ names, parser }) => {
    names.forEach((name) => {
      result[`[${name}]`] = parser;
    });
  });

  return result;
};

export const readInpData = (
  inp: string,
  issues: IssuesAccumulator,
  options?: ParseInpOptions,
): { inpData: InpData; stats: InpStats } => {
  const rows = inp.split("\n");
  let section: string | null = null;
  const inpData = nullInpData();
  const sectionParsers = buildSectionParsers();
  const counts = new Map<string, number>();

  function parseRow(trimmedRow: string) {
    if (!section) return;

    const rowParserFn = sectionParsers[section];
    if (!counts.has(section)) counts.set(section, 0);

    counts.set(section, (counts.get(section) || 0) + 1);

    if (!rowParserFn) return;

    const startsWithComment = trimmedRow.startsWith(commentIdentifier);

    rowParserFn({
      sectionName: section,
      trimmedRow: startsWithComment
        ? trimmedRow.substring(1).trim()
        : trimmedRow,
      inpData,
      issues,
      options,
      isCommented: startsWithComment,
    });
  }

  for (const row of rows) {
    const trimmedRow = row.trim();

    if (isEmpty(trimmedRow)) continue;

    if (isLineComment(trimmedRow)) {
      if (options?.customerPoints && trimmedRow === ";[CUSTOMERS]") {
        section = "CUSTOMERS_COMMENTED";
        continue;
      }
      if (section === "CUSTOMERS_COMMENTED" && trimmedRow.startsWith(";")) {
        parseCommentedCustomerPoint(trimmedRow, inpData);
        continue;
      }

      if (isLineHeader(trimmedRow)) {
        continue;
      }

      if (options?.inactiveAssets === true) parseRow(trimmedRow);
      continue;
    }

    if (isEnd(trimmedRow)) {
      section = null;
      continue;
    }

    const newSectionName = detectNewSectionName(
      trimmedRow,
      issues,
      sectionParsers,
    );
    if (newSectionName) {
      section = newSectionName;
      continue;
    }
    parseRow(trimmedRow);
  }

  return { inpData, stats: { counts } };
};

const isEnd = (trimmedRow: string) => {
  return trimmedRow.includes("[END]");
};

const isLineComment = (trimmedRow: string) =>
  trimmedRow.startsWith(commentIdentifier);

const isLineHeader = (trimmedRow: string): boolean => {
  if (!isLineComment(trimmedRow)) return false;
  const uncommentedRow = trimmedRow.substring(1).trim();
  const uncommentedRowUpper = uncommentedRow.toUpperCase();

  return (
    uncommentedRowUpper.startsWith("ID") ||
    uncommentedRowUpper.startsWith("NODE") ||
    uncommentedRowUpper.startsWith("LINK") ||
    uncommentedRow.startsWith("-")
  );
};

const isEmpty = (trimmedRow: string) => trimmedRow === "";

const detectNewSectionName = (
  trimmedRow: string,
  issues: IssuesAccumulator,
  sectionParsers: SectionParsers,
): string | null => {
  if (!trimmedRow.startsWith("[")) return null;

  const sectionName = Object.keys(sectionParsers).find((name) =>
    trimmedRow.includes(name),
  );
  if (sectionName === undefined) {
    issues.addUsedSection(trimmedRow);
    return trimmedRow;
  }
  return sectionName;
};

const parseCommentedCustomerPoint = (trimmedRow: string, inpData: InpData) => {
  const line = trimmedRow.substring(1);
  if (line.startsWith("Id\t") || line.startsWith("[CUSTOMERS]")) return;

  const parts = line.split("\t");
  if (parts.length < 4) return;

  const [
    rawLabel,
    x,
    y,
    demand,
    pipeId = "",
    junctionId = "",
    snapX = "",
    snapY = "",
  ] = parts;

  const label = rawLabel.substring(0, MAX_CUSTOMER_POINT_LABEL_LENGTH);

  const hasConnection = pipeId && junctionId && snapX && snapY;

  if (hasConnection) {
    inpData.customerPoints.push({
      label,
      coordinates: [parseFloat(x), parseFloat(y)],
      baseDemand: parseFloat(demand),
      pipeId,
      junctionId,
      snapPoint: [parseFloat(snapX), parseFloat(snapY)],
    });
  } else {
    inpData.customerPoints.push({
      label,
      coordinates: [parseFloat(x), parseFloat(y)],
      baseDemand: parseFloat(demand),
    });
  }
};
