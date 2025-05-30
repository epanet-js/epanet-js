import { RangeColorRule } from "./range-color-rule";

export const supportedProperties = [
  "elevation",
  "pressure",
  "flow",
  "velocity",
  "unitHeadloss",
  "diameter",
] as const;
export type SupportedProperty = (typeof supportedProperties)[number];

export type LabelRule = string | null;

export type NodeSymbology =
  | { type: "none"; labelRule: LabelRule }
  | {
      type: "elevation" | "pressure";
      colorRule: RangeColorRule;
      labelRule: LabelRule;
    };

export type LinkSymbology =
  | { type: "none"; labelRule: LabelRule }
  | {
      type: "flow" | "velocity" | "unitHeadloss" | "diameter";
      colorRule: RangeColorRule;
      labelRule: LabelRule;
    };

export type SymbologySpec = {
  node: NodeSymbology;
  link: LinkSymbology;
};

export const nullSymbologySpec: SymbologySpec = {
  link: { type: "none", labelRule: null },
  node: { type: "none", labelRule: null },
};
