import type { Pattern, Patterns } from "src/hydraulic-model/patterns";
import { multipliersSchema, patternRowSchema, type PatternRow } from "./schema";

export const toPatternRow = (pattern: Pattern): PatternRow => {
  const multipliersResult = multipliersSchema.safeParse(pattern.multipliers);
  if (!multipliersResult.success) {
    throw new Error(
      `Pattern ${pattern.id} (${pattern.label}): multipliers must be an array of finite numbers — ${multipliersResult.error.message}`,
    );
  }
  const candidate = {
    id: pattern.id,
    label: pattern.label,
    type: pattern.type ?? null,
    multipliers: JSON.stringify(multipliersResult.data),
  };
  const rowResult = patternRowSchema.safeParse(candidate);
  if (!rowResult.success) {
    throw new Error(
      `Pattern ${pattern.id} (${pattern.label}): row does not match schema — ${rowResult.error.message}`,
    );
  }
  return rowResult.data;
};

export const patternsToRows = (patterns: Patterns): PatternRow[] => {
  const rows: PatternRow[] = [];
  for (const pattern of patterns.values()) {
    rows.push(toPatternRow(pattern));
  }
  return rows;
};
