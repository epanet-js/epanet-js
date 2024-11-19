import { HydraulicModel } from "./hydraulic-model";
import { AssetId, Asset } from "./asset-types";

export type ModelMoment = {
  note: string;
  deleteAssets?: AssetId[];
  putAssets?: Asset[];
};

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;
