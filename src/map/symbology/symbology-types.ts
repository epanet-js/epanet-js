import { RangeColorRule } from "./range-color-rule";

export const supportedNodeProperties = [
  "elevation",
  "pressure",
  "head",
] as const;
export const supportedLinkProperties = [
  "flow",
  "velocity",
  "unitHeadloss",
  "diameter",
] as const;
export const supportedProperties = [
  ...supportedNodeProperties,
  ...supportedLinkProperties,
] as const;
export type SupportedProperty = (typeof supportedProperties)[number];

export type LabelRule = string | null;

export type NodeSymbology = {
  colorRule: RangeColorRule | null;
  labelRule: LabelRule | null;
};

export type LinkSymbology = {
  colorRule: RangeColorRule | null;
  labelRule: LabelRule | null;
};

export type SymbologySpec = {
  node: NodeSymbology;
  link: LinkSymbology;
};

export const nullSymbologySpec: SymbologySpec = {
  link: { colorRule: null, labelRule: null },
  node: { colorRule: null, labelRule: null },
};
