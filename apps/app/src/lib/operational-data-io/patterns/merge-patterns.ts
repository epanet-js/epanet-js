import type { Pattern, PatternId, Patterns } from "src/hydraulic-model";
import type { LabelManager } from "@epanet-js/hydraulic-model";
import type { ImportCounts } from "../import-result";
import type { ParsedPattern } from "./parse-patterns-file";
import { IdGenerator } from "@epanet-js/id-generator";

export type MergeResult = {
  patterns: Patterns;
  counts: ImportCounts;
};

const sameMultipliers = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

// Only a clash between two *explicit* types duplicates. Everything else
// replaces in place so the id survives and assets keep resolving.
const conflicts = (existing: Pattern, incoming: ParsedPattern): boolean =>
  !!existing.type && !!incoming.type && existing.type !== incoming.type;

export const mergePatterns = (
  existing: Patterns,
  incoming: ParsedPattern[],
  {
    labelManager,
    idGenerator,
  }: { labelManager: LabelManager; idGenerator: IdGenerator },
): MergeResult => {
  const merged: Patterns = new Map(existing);
  const byLabel = new Map<string, Pattern>();
  for (const pattern of existing.values()) {
    byLabel.set(pattern.label.toLowerCase(), pattern);
  }

  const touched = new Set<PatternId>();
  let added = 0;
  let updated = 0;
  let identical = 0;

  const append = (entry: ParsedPattern) => {
    const label = labelManager.isLabelAvailable(entry.label, "pattern")
      ? entry.label
      : labelManager.generateNextLabel(entry.label);
    const id = idGenerator.newId();

    merged.set(id, {
      id,
      label,
      type: entry.type,
      multipliers: entry.multipliers,
    });
    labelManager.register(label, "pattern", id);
    added += 1;
  };

  for (const entry of incoming) {
    const match = byLabel.get(entry.label.toLowerCase());

    if (!match || conflicts(match, entry)) {
      append(entry);
      continue;
    }

    touched.add(match.id);

    // A blank type in the file must not wipe a categorized pattern; an
    // explicit one promotes an uncategorized pattern.
    const type = entry.type ?? match.type;

    if (
      sameMultipliers(match.multipliers, entry.multipliers) &&
      type === match.type
    ) {
      identical += 1;
      continue;
    }

    merged.set(match.id, { ...match, type, multipliers: entry.multipliers });
    updated += 1;
  }

  return {
    patterns: merged,
    counts: {
      added,
      updated,
      identical,
      untouched: existing.size - touched.size,
    },
  };
};
