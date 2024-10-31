import { Asset, AssetId } from "./assets";
import { HydraulicModel } from "./hydraulic-model";

export type ModelMoment = {
  note: string;
  deleteAssets?: AssetId[];
  putAssets?: Asset[];
};

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;
