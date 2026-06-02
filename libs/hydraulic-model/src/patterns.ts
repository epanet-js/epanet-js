export type PatternMultipliers = number[];

export type PatternId = number;

export type PatternType =
  | "demand"
  | "reservoirHead"
  | "pumpSpeed"
  | "qualitySourceStrength"
  | "energyPrice";

export type Pattern = {
  id: PatternId;
  label: string;
  type?: PatternType;
  multipliers: number[];
};

export type Patterns = Map<PatternId, Pattern>;

export const getNextPatternId = (
  patterns: Patterns,
  startId?: number,
): PatternId => {
  let nextId = Math.max(startId ?? patterns.size, 1);
  while (patterns.has(nextId)) {
    nextId += 1;
  }
  return nextId;
};

export const deepClonePatterns = (patterns: Patterns): Patterns => {
  const cloned = new Map<PatternId, Pattern>();
  for (const [id, pattern] of patterns) {
    cloned.set(id, {
      ...pattern,
      multipliers: [...pattern.multipliers],
    });
  }
  return cloned;
};

export const isPatternEqual = (a: Pattern, b?: Pattern): boolean => {
  if (!b) return false;
  if (a.label !== b.label) return false;
  if (a.type !== b.type) return false;
  if (a.multipliers.length !== b.multipliers.length) return false;
  if (!a.multipliers.every((val, idx) => val === b.multipliers[idx]))
    return false;
  return true;
};

export const differentPatternsCount = (a: Patterns, b: Patterns): number => {
  const visitedIds = new Set<PatternId>();
  let count = 0;

  for (const [id, aPattern] of a) {
    visitedIds.add(id);
    const bPattern = b.get(id);
    if (!isPatternEqual(aPattern, bPattern)) {
      count += 1;
    }
  }
  for (const [id, bPattern] of b) {
    if (visitedIds.has(id)) continue;
    const aPattern = a.get(id);
    if (!isPatternEqual(bPattern, aPattern)) {
      count += 1;
    }
  }
  return count;
};
