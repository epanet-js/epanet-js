import { HydraulicModel } from "./hydraulic-model";
import { AssetId, AssetType } from "./asset-types";

export type ModelMoment = {
  note: string;
  deleteAssets?: AssetId[];
  putAssets?: AssetType[];
};

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;
