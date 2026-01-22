import {
  PatternMultipliers,
  DemandPatternsLegacy,
} from "src/hydraulic-model/demands";
import { ItemData, normalizeRef } from "./inp-data";

const DEFAULT_PATTERN_ID = "1";

export class PatternsBuilder {
  private builtPatterns: DemandPatternsLegacy = new Map();
  private usedPatternIds: Set<string> = new Set();
  private fallbackPatternId: string | undefined;

  constructor(
    private rawPatterns: ItemData<number[]>,
    defaultPatternId?: string,
  ) {
    const defaultPattern = this.getPatternData(DEFAULT_PATTERN_ID);
    const defaultCustomPattern = defaultPatternId
      ? this.getPatternData(defaultPatternId)
      : undefined;
    const fallbackPattern = defaultCustomPattern || defaultPattern;

    const isFallbackPatternConstant =
      !fallbackPattern || isConstantPattern(fallbackPattern);

    this.fallbackPatternId = isFallbackPatternConstant
      ? undefined
      : defaultCustomPattern
        ? normalizeRef(defaultPatternId!)
        : DEFAULT_PATTERN_ID;
  }

  getEffectivePatternId(patternId: string | undefined): string | undefined {
    const id = patternId || this.fallbackPatternId;
    if (!id) return undefined;

    const pattern = this.getPatternData(id);

    if (pattern && !isConstantPattern(pattern)) return normalizeRef(id);

    return undefined;
  }

  markPatternUsed(patternId: string | undefined) {
    if (!patternId) return;

    this.usedPatternIds.add(patternId);
  }

  getUsedPatterns(): DemandPatternsLegacy {
    const result: DemandPatternsLegacy = new Map();

    for (const normalizedId of this.usedPatternIds) {
      const pattern = this.builtPatterns.get(normalizedId);
      if (pattern) {
        result.set(normalizedId, pattern);
      }
    }

    return result;
  }

  private getPatternData(raw_id: string): PatternMultipliers | undefined {
    const normalizedId = normalizeRef(raw_id);

    const existingPattern = this.builtPatterns.get(normalizedId);
    if (existingPattern) return existingPattern;

    const rawFactors = this.rawPatterns.get(raw_id);
    if (!rawFactors) return undefined;

    const pattern: PatternMultipliers = rawFactors;
    this.builtPatterns.set(normalizedId, pattern);
    return pattern;
  }
}

const isConstantPattern = (pattern: PatternMultipliers): boolean => {
  return pattern.every((value) => value === 1);
};
