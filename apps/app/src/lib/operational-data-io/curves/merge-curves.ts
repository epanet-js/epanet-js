import type {
  CurveId,
  CurvePoint,
  Curves,
  ICurve,
  LabelManager,
} from "@epanet-js/hydraulic-model";
import type { IdGenerator } from "@epanet-js/id-generator";
import type { ImportCounts } from "../import-result";
import type { ParsedCurve } from "./parse-curves-file";

export type MergeResult = {
  curves: Curves;
  counts: ImportCounts;
};

const samePoints = (a: CurvePoint[], b: CurvePoint[]): boolean =>
  a.length === b.length &&
  a.every((point, index) => point.x === b[index].x && point.y === b[index].y);

// Only a clash between two *explicit* types duplicates. Everything else
// replaces in place so the id survives and assets keep resolving.
const conflicts = (existing: ICurve, incoming: ParsedCurve): boolean =>
  !!existing.type && !!incoming.type && existing.type !== incoming.type;

export const mergeCurves = (
  existing: Curves,
  incoming: ParsedCurve[],
  {
    labelManager,
    idGenerator,
  }: { labelManager: LabelManager; idGenerator: IdGenerator },
): MergeResult => {
  const merged: Curves = new Map(existing);
  const byLabel = new Map<string, ICurve>();
  for (const curve of existing.values()) {
    byLabel.set(curve.label.toLowerCase(), curve);
  }

  const touched = new Set<CurveId>();
  let added = 0;
  let updated = 0;
  let identical = 0;

  const append = (entry: ParsedCurve) => {
    const label = labelManager.isLabelAvailable(entry.label, "curve")
      ? entry.label
      : labelManager.generateNextLabel(entry.label);
    const id = idGenerator.newId();

    merged.set(id, { id, label, type: entry.type, points: entry.points });
    labelManager.register(label, "curve", id);
    added += 1;
  };

  for (const entry of incoming) {
    const match = byLabel.get(entry.label.toLowerCase());

    if (!match || conflicts(match, entry)) {
      append(entry);
      continue;
    }

    touched.add(match.id);

    // A blank type in the file must not wipe a categorized curve; an explicit
    // one promotes an uncategorized curve.
    const type = entry.type ?? match.type;

    if (samePoints(match.points, entry.points) && type === match.type) {
      identical += 1;
      continue;
    }

    merged.set(match.id, { ...match, type, points: entry.points });
    updated += 1;
  }

  return {
    curves: merged,
    counts: {
      added,
      updated,
      identical,
      notModified: existing.size - touched.size,
    },
  };
};
