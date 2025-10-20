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
  parseTimeSetting,
  parseVertex,
  parsePump,
  parseCurve,
  parseStatus,
  parseValve,
  unsupported,
} from "./row-parsers";

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
  { names: ["REACTIONS"], parser: unsupported },
  { names: ["TIMES"], parser: parseTimeSetting },
  { names: ["COORDINATES", "COORDINATE"], parser: parsePosition },
  { names: ["RESERVOIRS", "RESERVOIR"], parser: parseReservoir },
  { names: ["ENERGY"], parser: unsupported },
  { names: ["SOURCES"], parser: unsupported },
  { names: ["REPORT"], parser: ignore },
  { names: ["VERTICES", "VERTEX"], parser: parseVertex },
  { names: ["TANKS", "TANK"], parser: parseTank },
  { names: ["STATUS"], parser: parseStatus },
  { names: ["MIXING"], parser: unsupported },
  { names: ["LABELS"], parser: unsupported },
  { names: ["PIPES", "PIPE"], parser: parsePipe },
  { names: ["CONTROLS"], parser: unsupported },
  { names: ["PUMPS", "PUMP"], parser: parsePump },
  { names: ["RULES"], parser: unsupported },
  { names: ["VALVES", "VALVE"], parser: parseValve },
  { names: ["DEMANDS", "DEMAND"], parser: parseDemand },
  { names: ["EMITTERS"], parser: unsupported },
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
  let section = null;
  const inpData = nullInpData();
  const sectionParsers = buildSectionParsers();
  const counts = new Map<string, number>();

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
    if (!section) continue;

    const rowParserFn = sectionParsers[section];
    if (!counts.has(section)) counts.set(section, 0);

    counts.set(section, (counts.get(section) || 0) + 1);

    if (!rowParserFn) continue;

    rowParserFn({ sectionName: section, trimmedRow, inpData, issues, options });
  }

  return { inpData, stats: { counts } };
};

const isEnd = (trimmedRow: string) => {
  return trimmedRow.includes("[END]");
};

const isLineComment = (trimmedRow: string) =>
  trimmedRow.startsWith(commentIdentifier);

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
    id,
    x,
    y,
    demand,
    pipeId = "",
    junctionId = "",
    snapX = "",
    snapY = "",
  ] = parts;

  const hasConnection = pipeId && junctionId && snapX && snapY;

  if (hasConnection) {
    inpData.customerPoints.push({
      id,
      label: id,
      coordinates: [parseFloat(x), parseFloat(y)],
      baseDemand: parseFloat(demand),
      pipeId,
      junctionId,
      snapPoint: [parseFloat(snapX), parseFloat(snapY)],
    });
  } else {
    inpData.customerPoints.push({
      id,
      label: id,
      coordinates: [parseFloat(x), parseFloat(y)],
      baseDemand: parseFloat(demand),
    });
  }
};
