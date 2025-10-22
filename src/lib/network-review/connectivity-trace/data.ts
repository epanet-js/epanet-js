import { AssetId } from "src/hydraulic-model";

export interface Subnetwork {
  subnetworkId: number;
  nodeIds: AssetId[];
  linkIds: AssetId[];
  hasSupplySource: boolean;
  supplySourceTypes: string[];
  bounds: [number, number, number, number];
  color: string;
}

export const SUBNETWORK_COLORS = [
  "#E58606",
  "#5D69B1",
  "#52BCA3",
  "#99C945",
  "#CC61B0",
  "#24796C",
  "#DAA51B",
  "#2F8AC4",
  "#764E9F",
  "#ED645A",
  "#CC3A8E",
  "#A5AA99",
];
