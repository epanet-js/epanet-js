import { QuantityProperty } from "src/lib/project-settings/quantities-spec";
import { TimeSeries } from "src/simulation/epanet/eps-results-reader";

export type NodeProperty = "pressure" | "head";
export type LinkProperty = "flow" | "velocity" | "headloss";
export type QualityProperty =
  | "waterAge"
  | "waterTrace"
  | "chemicalConcentration";

export interface PropertyOption<T extends string> {
  value: T;
  labelKey: string;
  quantityKey: QuantityProperty;
}

export interface CustomGraphChartProps {
  seriesData: AssetTimeSeries[];
  nodeCount: number;
  nodeYAxisLabel: string;
  linkYAxisLabel: string;
  nodeDecimals: number;
  linkDecimals: number;
  unitLabels: string[];
}

export interface AssetTimeSeries {
  assetId: number;
  label: string;
  timeSeries: TimeSeries;
}
