import type { Pattern, Patterns } from "src/hydraulic-model/patterns";
import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";
import { multipliersSchema } from "./build-patterns-data";
import type { PatternRow } from "./rows";

export const toPatternRow = (pattern: Pattern): PatternRow => {
  const result = multipliersSchema.safeParse(pattern.multipliers);
  if (!result.success) {
    throw new Error(
      `Pattern ${pattern.id} (${pattern.label}): multipliers must be an array of finite numbers — ${result.error.message}`,
    );
  }
  return {
    id: pattern.id,
    label: pattern.label,
    type: pattern.type ?? null,
    multipliers: JSON.stringify(result.data),
  };
};

export const patternsToRows = (patterns: Patterns): PatternRow[] => {
  const rows: PatternRow[] = [];
  for (const pattern of patterns.values()) {
    rows.push(toPatternRow(pattern));
  }
  return rows;
};

export const setAllPatterns = async (patterns: Patterns): Promise<void> => {
  await timed("setAllPatterns", async () => {
    const rows = patternsToRows(patterns);
    const worker = getDbWorker();
    await worker.setAllPatterns(rows);
  });
};
