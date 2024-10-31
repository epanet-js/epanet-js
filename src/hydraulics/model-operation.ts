import { FeatureMap } from "src/types";
import { Topology } from "./topology";
import { AssetId } from "./assets";

type HydraulicModel = {
  assets: FeatureMap;
  topology: Topology;
};

type ModelMoment = {
  name: string;
  deleteAssets: AssetId[];
};

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;
