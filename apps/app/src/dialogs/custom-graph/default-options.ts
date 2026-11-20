import { SERIES_COLORS } from "src/lib/asset-graph";
import {
  LinkProperty,
  NodeProperty,
  PropertyOption,
  QualityProperty,
} from "./types";

const MAX_ASSETS = 100;
const MAX_VISIBLE_LEGENDS = 12;
const TOOLTIP_DECIMALS = 3;

const NODE_PROPERTIES: PropertyOption<NodeProperty>[] = [
  { value: "pressure", labelKey: "pressure", quantityKey: "pressure" },
  { value: "head", labelKey: "head", quantityKey: "head" },
];

const LINK_PROPERTIES: PropertyOption<LinkProperty>[] = [
  { value: "flow", labelKey: "flow", quantityKey: "flow" },
  {
    value: "flowAbsolute",
    labelKey: "customGraph.flowAbsolute",
    quantityKey: "flow",
  },
  { value: "velocity", labelKey: "velocity", quantityKey: "velocity" },
  {
    value: "headloss",
    labelKey: "unitHeadloss",
    quantityKey: "unitHeadloss",
  },
  { value: "status", labelKey: "status" },
];

const WATER_QUALITY_PROPERTIES = [
  "waterAge",
  "waterTrace",
  "chemicalConcentration",
];

const QUALITY_OPTIONS: Record<string, PropertyOption<QualityProperty>> = {
  age: {
    value: "waterAge",
    labelKey: "waterAge",
    quantityKey: "waterAge",
  },
  trace: {
    value: "waterTrace",
    labelKey: "waterTrace",
    quantityKey: "waterTrace",
  },
  chemical: {
    value: "chemicalConcentration",
    labelKey: "chemicalConcentration",
    quantityKey: "chemicalConcentration",
  },
};

export const GraphDefaultOptions = {
  MAX_ASSETS,
  MAX_VISIBLE_LEGENDS,
  TOOLTIP_DECIMALS,
  SERIES_COLORS,
  NODE_PROPERTIES,
  LINK_PROPERTIES,
  WATER_QUALITY_PROPERTIES,
  QUALITY_OPTIONS,
};
