import { AssetId } from "src/hydraulic-model";

export interface SubNetwork {
  subnetworkId: number;
  nodeIds: AssetId[];
  linkIds: AssetId[];
  supplySourceCount: number;
  pipeCount: number;
  bounds: [number, number, number, number];
}
