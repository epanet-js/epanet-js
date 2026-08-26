import { PatternType } from "src/hydraulic-model";

export const PATTERN_TYPES: PatternType[] = [
  "demand",
  "reservoirHead",
  "pumpSpeed",
  "qualitySourceStrength",
  "energyPrice",
];

export const PATTERN_TYPE_TRANSLATION_KEYS: Record<PatternType, string> = {
  demand: "patterns.demandPatterns",
  reservoirHead: "patterns.reservoirHeadPatterns",
  pumpSpeed: "patterns.pumpSpeedPatterns",
  qualitySourceStrength: "patterns.qualitySourceStrengthPatterns",
  energyPrice: "patterns.energyPricePatterns",
};

export type PatternTypeLabels = Record<PatternType, string>;

export const buildPatternTypeLabels = (
  translate: (key: string) => string,
): PatternTypeLabels =>
  Object.fromEntries(
    PATTERN_TYPES.map((type) => [
      type,
      translate(PATTERN_TYPE_TRANSLATION_KEYS[type]),
    ]),
  ) as PatternTypeLabels;
