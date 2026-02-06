import { HydraulicModel } from "./hydraulic-model";
import { AssetId, Asset } from "./asset-types";
import { Demands } from "./demands";
import { CustomerPoint } from "./customer-points";
import { Curves } from "./curves";
import { EPSTiming } from "./eps-timing";
import { Controls } from "./controls";

export type ModelMoment = {
  note: string;
  deleteAssets?: AssetId[];
  putAssets?: Asset[];
  putDemands?: Demands;
  putEPSTiming?: EPSTiming;
  putCustomerPoints?: CustomerPoint[];
  putCurves?: Curves;
  putControls?: Controls;
};

export type ReverseMoment = {
  note: string;
  deleteAssets: AssetId[];
  putAssets: Asset[];
  putDemands?: Demands;
  putEPSTiming?: EPSTiming;
  putCustomerPoints: CustomerPoint[];
  putCurves?: Curves;
  putControls?: Controls;
};

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;
