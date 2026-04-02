import { colors } from "src/lib/constants";
import { RangeColorRule } from "./range-color-rule";

export const supportedNodeProperties = [
  "elevation",
  "pressure",
  "actualDemand",
  "head",
  "waterAge",
] as const;
export const supportedLinkProperties = [
  "flow",
  "velocity",
  "unitHeadloss",
  "diameter",
  "roughness",
  "waterAge",
] as const;
export const supportedProperties = [
  ...supportedNodeProperties,
  ...supportedLinkProperties,
] as const;
export type SupportedProperty = (typeof supportedProperties)[number];

export type LabelRule = string | null;

export type NodeDefaults = {
  color: string;
};

export type LinkDefaults = {
  color: string;
};

export type NodeSymbology = {
  colorRule: RangeColorRule | null;
  labelRule: LabelRule | null;
  defaults: NodeDefaults;
};

export type LinkSymbology = {
  colorRule: RangeColorRule | null;
  labelRule: LabelRule | null;
  defaults: LinkDefaults;
};

export type CustomerPointsSymbology = {
  visible: boolean;
};

export type SymbologySpec = {
  node: NodeSymbology;
  link: LinkSymbology;
  customerPoints: CustomerPointsSymbology;
};

export const nullSymbologySpec: SymbologySpec = {
  link: {
    colorRule: null,
    labelRule: null,
    defaults: { color: colors.indigo900 },
  },
  node: {
    colorRule: null,
    labelRule: null,
    defaults: { color: colors.indigo200 },
  },
  customerPoints: { visible: true },
};
