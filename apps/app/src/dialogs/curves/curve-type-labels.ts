import { CurveType } from "@epanet-js/hydraulic-model";

export const CURVE_TYPES: CurveType[] = [
  "pump",
  "efficiency",
  "volume",
  "valve",
  "headloss",
];

export const CURVE_TYPE_TRANSLATION_KEYS: Record<CurveType, string> = {
  pump: "curves.pumpCurves",
  efficiency: "curves.efficiencyCurves",
  volume: "curves.volumeCurves",
  valve: "curves.valveCurves",
  headloss: "curves.headlossCurves",
};

export type CurveTypeLabels = Record<CurveType, string>;

export const buildCurveTypeLabels = (
  translate: (key: string) => string,
): CurveTypeLabels =>
  Object.fromEntries(
    CURVE_TYPES.map((type) => [
      type,
      translate(CURVE_TYPE_TRANSLATION_KEYS[type]),
    ]),
  ) as CurveTypeLabels;
