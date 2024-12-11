import { RangeColorMapping } from "./range-color-mapping";

export type PressuresAnalysis = {
  type: "pressures";
  rangeColorMapping: RangeColorMapping;
};

export type FlowsAnalysis = {
  type: "flows";
  rangeColorMapping: RangeColorMapping;
};

export type NodesAnalysis = { type: "none" } | PressuresAnalysis;
export type LinksAnalysis = { type: "none" } | FlowsAnalysis;
