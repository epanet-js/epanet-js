import { HydraulicModel } from "./hydraulic-model";
import { AssetId, Asset } from "./asset-types";
import { Demands } from "./demands";
import { CustomerPoint } from "./customer-points";
import { Curves } from "./curves";

export type ModelMoment = {
  note: string;
  deleteAssets?: AssetId[];
  putAssets?: Asset[];
  putDemands?: Demands;
  putCustomerPoints?: CustomerPoint[];
  putCurves?: Curves;
};

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;
