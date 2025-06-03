import { HydraulicModel } from "./hydraulic-model";
import { AssetId, Asset } from "./asset-types";
import { Demands } from "./demands";

export type ModelMoment = {
  note: string;
  deleteAssets?: AssetId[];
  putAssets?: Asset[];
  putDemands?: Demands;
};

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;
