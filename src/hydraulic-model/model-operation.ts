import { HydraulicModel } from "./hydraulic-model";
import { Asset } from "./asset-types";
import type { AssetPropertiesMap } from "./asset-types";
import { Demand, Demands } from "./demands";
import { CustomerPoint, CustomerPointId } from "./customer-points";
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

export type JunctionDemandAssignment = {
  junctionId: AssetId;
  demands: Demand[];
};
export type CustomerDemandAssignment = {
  customerPointId: CustomerPointId;
  demands: Demand[];
};

export type DemandAssignment =
  | JunctionDemandAssignment
  | CustomerDemandAssignment;

export type DemandSettingsChange = Partial<
  Pick<Demands, "multiplier" | "patterns"> & {
    assignments: DemandAssignment[];
  }
>;

export const toDemandAssignments = (demands: Demands): DemandAssignment[] => {
  const result: DemandAssignment[] = [];
  for (const [junctionId, junctionDemands] of demands.junctions) {
    result.push({ junctionId, demands: junctionDemands });
  }
  for (const [customerPointId, customerDemands] of demands.customerPoints) {
    result.push({ customerPointId, demands: customerDemands });
  }
  return result;
};

export type ModelMoment = {
  note: string;
  deleteAssets?: AssetId[];
  putAssets?: Asset[];
  patchAssetsAttributes?: AssetPatch[];
  putDemands?: DemandSettingsChange;
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
  putDemands?: DemandSettingsChange;
  putEPSTiming?: EPSTiming;
  putCustomerPoints: CustomerPoint[];
  putCurves?: Curves;
  putControls?: Controls;
};

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;
