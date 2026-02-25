import {
  Curves,
  ICurve,
  CurveId,
  CurvePoint,
  CurveType,
  CurveErrorPoint,
  getPumpCurveErrors,
} from "src/hydraulic-model/curves";
import { QuantityProperty } from "src/model-metadata/quantities-spec";
import { HydraulicModel } from "src/hydraulic-model";
import { Pump } from "src/hydraulic-model/asset-types/pump";
import { LabelManager } from "src/hydraulic-model/label-manager";

export interface CurveTypeConfig {
  xLabel: string;
  yLabel: string;
  xQuantity?: QuantityProperty;
  yQuantity?: QuantityProperty;
  getErrors: (points: CurvePoint[]) => CurveErrorPoint[];
}

const getGenericCurveErrors = (points: CurvePoint[]): CurveErrorPoint[] => {
  if (points.length === 0) return [];

  if (points.length === 1) {
    const errors: CurveErrorPoint[] = [];
    if (points[0].x === 0) errors.push({ index: 0, value: "x" });
    if (points[0].y === 0) errors.push({ index: 0, value: "y" });
    return errors;
  }

  const errors: CurveErrorPoint[] = [];
  const seen = new Set<string>();
  const add = (index: number) => {
    const key = `${index}:x`;
    if (!seen.has(key)) {
      seen.add(key);
      errors.push({ index, value: "x" });
    }
  };

  for (let i = 1; i < points.length; i++) {
    if (points[i].x <= points[i - 1].x) {
      add(i - 1);
      add(i);
    }
  }
  return errors;
};

const pumpCurveConfig: CurveTypeConfig = {
  xLabel: "flow",
  yLabel: "head",
  xQuantity: "flow",
  yQuantity: "head",
  getErrors: getPumpCurveErrors,
};

const defaultCurveConfig: CurveTypeConfig = {
  xLabel: "x",
  yLabel: "y",
  getErrors: getGenericCurveErrors,
};

export const getCurveTypeConfig = (type?: CurveType): CurveTypeConfig => {
  switch (type) {
    case "pump":
      return pumpCurveConfig;
    default:
      return defaultCurveConfig;
  }
};

export const deepCloneCurves = (curves: Curves): Curves => {
  const cloned = new Map<CurveId, ICurve>();
  for (const [id, curve] of curves) {
    cloned.set(id, {
      ...curve,
      points: curve.points.map((p) => ({ ...p })),
    });
  }
  return cloned;
};

export const createLabelManagerFromCurves = (curves: Curves): LabelManager => {
  const lm = new LabelManager();
  for (const curve of curves.values()) {
    lm.register(curve.label, "curve", curve.id);
  }
  return lm;
};

export const isCurveInUse = (
  hydraulicModel: HydraulicModel,
  curveId: CurveId,
): boolean => {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset instanceof Pump && asset.curveId === curveId) {
      return true;
    }
  }
  return false;
};

export const areCurvesEqual = (original: Curves, edited: Curves): boolean => {
  if (original.size !== edited.size) return false;
  for (const [id, originalCurve] of original) {
    const editedCurve = edited.get(id);
    if (!editedCurve) return false;
    if (originalCurve.label !== editedCurve.label) return false;
    if (originalCurve.type !== editedCurve.type) return false;
    if (originalCurve.points.length !== editedCurve.points.length) return false;
    if (
      !originalCurve.points.every(
        (p, idx) =>
          p.x === editedCurve.points[idx].x &&
          p.y === editedCurve.points[idx].y,
      )
    )
      return false;
  }
  return true;
};
