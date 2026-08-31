import { text, type Cell } from "./table-file";

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ");

// Enum keys win before any partial matching, so a bare "pump" resolves to the
// type whose key that is rather than reading as an ambiguous prefix of two
// labels. Containment is checked both ways, so an abbreviation ("speed") and a
// phrase built around the label ("Pump speed pattern") both resolve. Anything
// matching more than one type is left uncategorized rather than guessed at.
export const resolveType = <T extends string>(
  cell: Cell,
  labels: Record<T, string>,
): T | undefined => {
  const normalized = normalize(text(cell));
  if (normalized === "") return undefined;

  const entries = Object.entries(labels) as [T, string][];

  const byKey = entries.find(([type]) => normalize(type) === normalized);
  if (byKey) return byKey[0];

  const byLabel = entries.find(([, label]) => normalize(label) === normalized);
  if (byLabel) return byLabel[0];

  const partial = entries.filter(([, label]) => {
    const candidate = normalize(label);
    return candidate.includes(normalized) || normalized.includes(candidate);
  });

  return partial.length === 1 ? partial[0][0] : undefined;
};
