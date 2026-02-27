import {
  CurvePoint,
  CurveType,
  CurveErrorPoint,
  getPumpCurveErrors,
  getGenericCurveErrors,
  getVolumeCurveErrors,
  getHeadlossCurveErrors,
  getValveCurveErrors,
  getEfficiencyCurveErrors,
} from "src/hydraulic-model/curves";
import { QuantityProperty } from "src/model-metadata/quantities-spec";

export type CurveInterpolation =
  | { type: "fitted" }
  | { type: "linear" }
  | { type: "linear-range"; start: CurvePoint; end: CurvePoint };

export interface CurveTypeConfig {
  xLabel: string;
  yLabel: string;
  xQuantity?: QuantityProperty;
  yQuantity?: QuantityProperty;
  getErrors: (points: CurvePoint[]) => CurveErrorPoint[];
  interpolation: CurveInterpolation;
}

const pumpCurveConfig: CurveTypeConfig = {
  xLabel: "flow",
  yLabel: "head",
  xQuantity: "flow",
  yQuantity: "head",
  getErrors: getPumpCurveErrors,
  interpolation: { type: "fitted" },
};

const volumeCurveConfig: CurveTypeConfig = {
  xLabel: "level",
  yLabel: "volume",
  xQuantity: "level",
  yQuantity: "volume",
  getErrors: getVolumeCurveErrors,
  interpolation: { type: "linear" },
};

const headlossCurveConfig: CurveTypeConfig = {
  xLabel: "flow",
  yLabel: "headloss",
  xQuantity: "flow",
  yQuantity: "headloss",
  getErrors: getHeadlossCurveErrors,
  interpolation: { type: "linear" },
};

const efficiencyCurveConfig: CurveTypeConfig = {
  xLabel: "flow",
  yLabel: "efficiency",
  xQuantity: "flow",
  yQuantity: "efficiency",
  getErrors: getEfficiencyCurveErrors,
  interpolation: { type: "linear" },
};

const valveCurveConfig: CurveTypeConfig = {
  xLabel: "percentOpen",
  yLabel: "percentFullFlow",
  yQuantity: "valveFlowCoeffRatio",
  getErrors: getValveCurveErrors,
  interpolation: {
    type: "linear-range",
    start: { x: 0, y: 0 },
    end: { x: 100, y: 100 },
  },
};

const defaultCurveConfig: CurveTypeConfig = {
  xLabel: "x",
  yLabel: "y",
  getErrors: getGenericCurveErrors,
  interpolation: { type: "linear" },
};

export const getCurveTypeConfig = (type?: CurveType): CurveTypeConfig => {
  switch (type) {
    case "pump":
      return pumpCurveConfig;
    case "efficiency":
      return efficiencyCurveConfig;
    case "volume":
      return volumeCurveConfig;
    case "headloss":
      return headlossCurveConfig;
    case "valve":
      return valveCurveConfig;
    default:
      return defaultCurveConfig;
  }
};
