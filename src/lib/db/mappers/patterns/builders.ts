import type { Pattern, Patterns } from "src/hydraulic-model/patterns";
import { multipliersSchema, type PatternRow } from "./schema";

export const buildPatternsData = (rows: PatternRow[]): Patterns => {
  const patterns: Patterns = new Map();
  for (const row of rows) {
    const pattern: Pattern = {
      id: row.id,
      label: row.label,
      multipliers: parseMultipliers(row),
    };
    if (row.type !== null) pattern.type = row.type;
    patterns.set(row.id, pattern);
  }
  return patterns;
};

const parseMultipliers = (row: PatternRow): number[] => {
  let raw: unknown;
  try {
    raw = JSON.parse(row.multipliers);
  } catch (error) {
    throw new Error(
      `Pattern ${row.id} (${row.label}): multipliers is not valid JSON`,
      { cause: error },
    );
  }
  const result = multipliersSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Pattern ${row.id} (${row.label}): multipliers must be an array of finite numbers — ${result.error.message}`,
    );
  }
  return result.data;
};
