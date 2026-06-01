import { colors } from "src/lib/constants";
import { RangeColorRule } from "./range-color-rule";

export const supportedNodeProperties = [
  "elevation",
  "pressure",
  "minPressure",
  "maxPressure",
  "actualDemand",
  "head",
  "waterAge",
  "waterTrace",
  "chemicalConcentration",
] as const;
export const supportedLinkProperties = [
  "flow",
  "velocity",
  "unitHeadloss",
  "diameter",
  "roughness",
  "waterAge",
  "waterTrace",
  "chemicalConcentration",
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

export type NodeSizeConfig = {
  // Zoom at which junctions reach minSize; below it the radius clamps to minSize.
  minVisibleZoom: number;
  // Radius (px) at minVisibleZoom.
  minSize: number;
  // Radius (px) at the maximum map zoom.
  maxSize: number;
};

export const defaultNodeSizeConfig: NodeSizeConfig = {
  minVisibleZoom: 12,
  minSize: 1,
  maxSize: 5,
};

export type LinkSymbology = {
  colorRule: RangeColorRule | null;
  labelRule: LabelRule | null;
  defaults: LinkDefaults;
};

export type CustomerPointsSymbology = {
  visible: boolean;
};

export type ZoneDefaults = {
  color: string;
};

export type ZoneLabelRule = "label" | null;
export type ZoneColorRule = "label" | null;

export type ZoneSymbology = {
  visible: boolean;
  defaults: ZoneDefaults;
  labelRule: ZoneLabelRule;
  colorRule: ZoneColorRule;
  paletteName: string;
  opacity: number;
};

export type SymbologySpec = {
  node: NodeSymbology;
  link: LinkSymbology;
  customerPoints: CustomerPointsSymbology;
  zone: ZoneSymbology;
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
  zone: {
    visible: true,
    defaults: { color: "#ea580c" },
    labelRule: null,
    colorRule: null,
    paletteName: "Bold",
    opacity: 0.15,
  },
};
