import { colors } from "src/lib/constants";
import {
  LinkProperty,
  NodeProperty,
  PropertyOption,
  QualityProperty,
} from "./types";

const MAX_VISIBLE_LEGENDS = 12;
const TOOLTIP_DECIMALS = 3;

const SERIES_COLORS = [
  colors.purple500,
  colors.blue500,
  colors.orange500,
  colors.cyan700,
  colors.fuchsia500,
  colors.green800,
  colors.red600,
  colors.indigo500,
  colors.amber500,
  colors.cyan900,
];

const NODE_PROPERTIES: PropertyOption<NodeProperty>[] = [
  { value: "pressure", labelKey: "pressure", quantityKey: "pressure" },
  { value: "head", labelKey: "head", quantityKey: "head" },
];

const LINK_PROPERTIES: PropertyOption<LinkProperty>[] = [
  { value: "flow", labelKey: "flow", quantityKey: "flow" },
  { value: "velocity", labelKey: "velocity", quantityKey: "velocity" },
  {
    value: "headloss",
    labelKey: "unitHeadloss",
    quantityKey: "unitHeadloss",
  },
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
  MAX_VISIBLE_LEGENDS,
  TOOLTIP_DECIMALS,
  SERIES_COLORS,
  NODE_PROPERTIES,
  LINK_PROPERTIES,
  WATER_QUALITY_PROPERTIES,
  QUALITY_OPTIONS,
};
