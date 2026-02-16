import { HydraulicModel } from "./hydraulic-model";
import { Asset } from "./asset-types";
import type { AssetPropertiesMap } from "./asset-types";
import { Demands } from "./demands";
import { CustomerPoint } from "./customer-points";
import { Curves } from "./curves";
import { EPSTiming } from "./eps-timing";
import { Controls } from "./controls";
import type { AssetId } from "./assets-map";

type NonPatchableKeys = "type" | "connections";

export type AssetPatch = {
  [K in keyof AssetPropertiesMap]: {
    id: AssetId;
    type: K;
    properties: Partial<Omit<AssetPropertiesMap[K], NonPatchableKeys>>;
  };
}[keyof AssetPropertiesMap];

export type ModelMoment = {
  note: string;
  deleteAssets?: AssetId[];
  putAssets?: Asset[];
  patchAssetsAttributes?: AssetPatch[];
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
  patchAssetsAttributes: AssetPatch[];
  putDemands?: Demands;
  putEPSTiming?: EPSTiming;
  putCustomerPoints: CustomerPoint[];
  putCurves?: Curves;
  putControls?: Controls;
};

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;
