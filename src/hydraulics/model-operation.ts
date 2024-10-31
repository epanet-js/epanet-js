import { AssetId } from "./assets";
import { HydraulicModel } from "./hydraulic-model";

export type ModelMoment = {
  name: string;
  deleteAssets: AssetId[];
};

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;
