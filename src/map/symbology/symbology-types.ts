import { colors } from "src/lib/constants";
import { RangeColorRule } from "./range-color-rule";

/** Zoom level at which minSize applies (start of the size ramp). */
export const NODE_SIZE_RAMP_MIN_ZOOM = 8;
/** Zoom level at which maxSize is fully reached (practical map max). */
export const NODE_SIZE_RAMP_MAX_ZOOM = 20;
/**
 * Upper zoom cap passed to setLayerZoomRange for regular junction layers.
 * Must be strictly greater than the app's maxZoom (26) so the layer is never
 * hidden at max zoom — Mapbox hides when zoom >= maxzoom (exclusive upper bound).
 */
export const NODE_LAYER_MAX_ZOOM = 30;
/** Zoom cap for the zoomed-out result dot layer. */
export const NODE_RESULT_LAYER_MAX_ZOOM = 13;

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
  minVisibility: number;
  minSize: number;
  maxSize: number;
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
    defaults: {
      color: colors.indigo200,
      minVisibility: 14,
      minSize: 3,
      maxSize: 10,
    },
  },
  customerPoints: { visible: true },
};
