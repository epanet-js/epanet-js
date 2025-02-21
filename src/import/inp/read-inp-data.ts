import { InpData, nullInpData } from "./inp-data";
import { IssuesAccumulator } from "./issues";
import {
  RowParser,
  ignore,
  parseDemand,
  parseJunction,
  parseOption,
  parsePipe,
  parsePosition,
  parseReservoir,
  parseTimeSetting,
  parseVertex,
  unsupported,
} from "./row-parsers";

const commentIdentifier = ";";

const sectionParsers: Record<string, RowParser> = {
  "[TITLE]": ignore,
  "[CURVES]": unsupported,
  "[QUALITY]": unsupported,
  "[OPTIONS]": parseOption,
  "[BACKDROP]": unsupported,
  "[JUNCTIONS]": parseJunction,
  "[PATTERNS]": unsupported,
  "[REACTIONS]": unsupported,
  "[TIMES]": parseTimeSetting,
  "[COORDINATES]": parsePosition,
  "[RESERVOIRS]": parseReservoir,
  "[ENERGY]": unsupported,
  "[SOURCES]": unsupported,
  "[REPORT]": ignore,
  "[VERTICES]": parseVertex,
  "[TANKS]": unsupported,
  "[STATUS]": unsupported,
  "[MIXING]": unsupported,
  "[LABELS]": unsupported,
  "[PIPES]": parsePipe,
  "[CONTROLS]": unsupported,
  "[PUMPS]": unsupported,
  "[RULES]": unsupported,
  "[VALVES]": unsupported,
  "[DEMANDS]": parseDemand,
  "[EMITTERS]": unsupported,
};

export const readInpData = (
  inp: string,
  issues: IssuesAccumulator,
): InpData => {
  const rows = inp.split("\n");
  let section = null;
  const inpData = nullInpData();

  for (const row of rows) {
    const trimmedRow = row.trim();

    if (trimmedRow.startsWith(commentIdentifier)) continue;
    if (isSectionEnded(trimmedRow)) {
      section = null;
      continue;
    }

    const newSectionName = detectNewSectionName(trimmedRow, issues);
    if (newSectionName) {
      section = newSectionName;
      continue;
    }
    if (!section) continue;

    const rowParserFn = sectionParsers[section];
    if (!rowParserFn) continue;

    rowParserFn({ sectionName: section, trimmedRow, inpData, issues });
  }

  return inpData;
};

const isSectionEnded = (trimmedRow: string) => {
  return trimmedRow === "" || trimmedRow.includes("[END]");
};

const detectNewSectionName = (
  trimmedRow: string,
  issues: IssuesAccumulator,
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
