export type PatternMultipliers = number[];

export type PatternId = number;

export type Pattern = {
  id: PatternId;
  label: string;
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
