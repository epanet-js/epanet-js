import { InpData, InpStats, nullInpData } from "./inp-data";
import { IssuesAccumulator } from "./issues";
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

const buildSectionParsers = (): SectionParsers => ({
  "[TITLE]": ignore,
  "[CURVES]": parseCurve,
  "[QUALITY]": unsupported,
  "[OPTIONS]": parseOption,
  "[BACKDROP]": ignore,
  "[JUNCTIONS]": parseJunction,
  "[PATTERNS]": parsePattern,
  "[REACTIONS]": unsupported,
  "[TIMES]": parseTimeSetting,
  "[COORDINATES]": parsePosition,
  "[RESERVOIRS]": parseReservoir,
  "[ENERGY]": unsupported,
  "[SOURCES]": unsupported,
  "[REPORT]": ignore,
  "[VERTICES]": parseVertex,
  "[TANKS]": parseTank,
  "[STATUS]": parseStatus,
  "[MIXING]": unsupported,
  "[LABELS]": unsupported,
  "[PIPES]": parsePipe,
  "[CONTROLS]": unsupported,
  "[PUMPS]": parsePump,
  "[RULES]": unsupported,
  "[VALVES]": parseValve,
  "[DEMANDS]": parseDemand,
  "[EMITTERS]": unsupported,
});

export const readInpData = (
  inp: string,
  issues: IssuesAccumulator,
): { inpData: InpData; stats: InpStats } => {
  const rows = inp.split("\n");
  let section = null;
  const inpData = nullInpData();
  const sectionParsers = buildSectionParsers();
  const counts = new Map<string, number>();

  for (const row of rows) {
    const trimmedRow = row.trim();

    if (isLineComment(trimmedRow) || isEmpty(trimmedRow)) continue;
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

    rowParserFn({ sectionName: section, trimmedRow, inpData, issues });
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
