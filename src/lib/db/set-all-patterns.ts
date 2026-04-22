import type { Pattern, Patterns } from "src/hydraulic-model/patterns";
import { getDbWorker } from "./get-db-worker";
import type { PatternRow } from "./rows";

export const toPatternRow = (pattern: Pattern): PatternRow => ({
  id: pattern.id,
  label: pattern.label,
  type: pattern.type ?? null,
  multipliers: JSON.stringify(pattern.multipliers),
});

export const patternsToRows = (patterns: Patterns): PatternRow[] => {
  const rows: PatternRow[] = [];
  for (const pattern of patterns.values()) {
    rows.push(toPatternRow(pattern));
  }
  return rows;
};

export const setAllPatterns = async (patterns: Patterns): Promise<void> => {
  const rows = patternsToRows(patterns);
  const worker = getDbWorker();
  await worker.setAllPatterns(rows);
};
