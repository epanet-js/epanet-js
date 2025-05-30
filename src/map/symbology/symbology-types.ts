import { isFeatureOn } from "src/infra/feature-flags";
import { RangeColorRule } from "./range-color-rule";

export const supportedNodeProperties = isFeatureOn("FLAG_HEAD")
  ? (["elevation", "pressure", "head"] as const)
  : (["elevation", "pressure"] as const);
export const supportedProperties = [
  ...supportedNodeProperties,
  "flow",
  "velocity",
  "unitHeadloss",
  "diameter",
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
