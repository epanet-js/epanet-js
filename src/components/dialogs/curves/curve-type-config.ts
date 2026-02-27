import {
  CurveType,
  CurveErrorPoint,
  CurvePoint,
  getPumpCurveErrors,
  getGenericCurveErrors,
  getVolumeCurveErrors,
  getHeadlossCurveErrors,
  getValveCurveErrors,
  getEfficiencyCurveErrors,
} from "src/hydraulic-model/curves";
import { QuantityProperty } from "src/model-metadata/quantities-spec";

export interface CurveTypeConfig {
  xLabel: string;
  yLabel: string;
  xQuantity?: QuantityProperty;
  yQuantity?: QuantityProperty;
  getErrors: (points: CurvePoint[]) => CurveErrorPoint[];
}

const pumpCurveConfig: CurveTypeConfig = {
  xLabel: "flow",
  yLabel: "head",
  xQuantity: "flow",
  yQuantity: "head",
  getErrors: getPumpCurveErrors,
};

const volumeCurveConfig: CurveTypeConfig = {
  xLabel: "level",
  yLabel: "volume",
  xQuantity: "level",
  yQuantity: "volume",
  getErrors: getVolumeCurveErrors,
};

const headlossCurveConfig: CurveTypeConfig = {
  xLabel: "flow",
  yLabel: "headloss",
  xQuantity: "flow",
  yQuantity: "headloss",
  getErrors: getHeadlossCurveErrors,
};

const efficiencyCurveConfig: CurveTypeConfig = {
  xLabel: "flow",
  yLabel: "efficiency",
  xQuantity: "flow",
  yQuantity: "efficiency",
  getErrors: getEfficiencyCurveErrors,
};

const valveCurveConfig: CurveTypeConfig = {
  xLabel: "percentOpen",
  yLabel: "percentFullFlow",
  yQuantity: "valveFlowCoeffRatio",
  getErrors: getValveCurveErrors,
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
