import { CurveType } from "@epanet-js/hydraulic-model";
import { QuantityProperty } from "@epanet-js/project-settings";

export interface CurveTypeConfig {
  xLabel: string;
  yLabel: string;
  xQuantity?: QuantityProperty;
  yQuantity?: QuantityProperty;
}

const pumpCurveConfig: CurveTypeConfig = {
  xLabel: "flow",
  yLabel: "head",
  xQuantity: "flow",
  yQuantity: "head",
};

const volumeCurveConfig: CurveTypeConfig = {
  xLabel: "level",
  yLabel: "volume",
  xQuantity: "level",
  yQuantity: "volume",
};

const headlossCurveConfig: CurveTypeConfig = {
  xLabel: "flow",
  yLabel: "headloss",
  xQuantity: "flow",
  yQuantity: "headloss",
};

const efficiencyCurveConfig: CurveTypeConfig = {
  xLabel: "flow",
  yLabel: "efficiency",
  xQuantity: "flow",
  yQuantity: "efficiency",
};

const valveCurveConfig: CurveTypeConfig = {
  xLabel: "percentOpen",
  yLabel: "percentFullFlow",
};

const defaultCurveConfig: CurveTypeConfig = {
  xLabel: "x",
  yLabel: "y",
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
