import type {
  Pattern,
  PatternType,
  Patterns,
} from "src/hydraulic-model/patterns";
import type { PatternRow } from "./rows";

export const buildPatternsData = (rows: PatternRow[]): Patterns => {
  const patterns: Patterns = new Map();
  for (const row of rows) {
    const multipliers = JSON.parse(row.multipliers) as number[];
    const pattern: Pattern = {
      id: row.id,
      label: row.label,
      multipliers,
    };
    if (row.type !== null) {
      pattern.type = row.type as PatternType;
    }
    patterns.set(row.id, pattern);
  }
  return patterns;
};
