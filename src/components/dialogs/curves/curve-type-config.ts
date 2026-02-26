import {
  CurvePoint,
  CurveType,
  CurveErrorPoint,
  getPumpCurveErrors,
  getGenericCurveErrors,
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
