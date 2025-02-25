import { isFeatureOn } from "src/infra/feature-flags";
import { InpData, nullInpData } from "./inp-data";
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
  parseTankPartially,
  parseTimeSetting,
  parseVertex,
  unsupported,
} from "./row-parsers";

const commentIdentifier = ";";

type SectionParsers = Record<string, RowParser>;

const buildSectionParsers = (): SectionParsers => ({
  "[TITLE]": ignore,
  "[CURVES]": unsupported,
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
  "[TANKS]": isFeatureOn("FLAG_TANKS") ? parseTankPartially : unsupported,
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
});

export const readInpData = (
  inp: string,
  issues: IssuesAccumulator,
): InpData => {
  const rows = inp.split("\n");
  let section = null;
  const inpData = nullInpData();
  const sectionParsers = buildSectionParsers();

  for (const row of rows) {
    const trimmedRow = row.trim();

    if (trimmedRow.startsWith(commentIdentifier)) continue;
    if (isSectionEnded(trimmedRow)) {
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
