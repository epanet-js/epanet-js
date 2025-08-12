import { HydraulicModel } from "./hydraulic-model";
import { AssetId, Asset } from "./asset-types";
import { Demands } from "./demands";
import { CustomerPoint } from "./customer-points";

export type ModelMoment = {
  note: string;
  deleteAssets?: AssetId[];
  putAssets?: Asset[];
  putDemands?: Demands;
  putCustomerPoints?: CustomerPoint[];
};

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;
