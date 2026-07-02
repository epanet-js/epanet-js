import { HydraulicModel } from "./hydraulic-model";
import {
  Asset,
  type AssetPropertiesMap,
  CustomerPoint,
  CustomerPointId,
  Curves,
  Patterns,
} from "@epanet-js/hydraulic-model";
import { Demand, Demands } from "@epanet-js/hydraulic-model";
import { RawControls } from "@epanet-js/hydraulic-model";
import { Controls } from "@epanet-js/hydraulic-model";
import type { AssetId } from "@epanet-js/hydraulic-model";
import type { CustomAttributesDefinition } from "@epanet-js/custom-attributes";

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

export type DemandSettingsChange = {
  assignments?: DemandAssignment[];
};

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

export type OptionalMomentFields = {
  putDemands?: DemandSettingsChange;
  putRawControls?: RawControls;
  putControls?: Controls;
  putCustomerPoints?: CustomerPoint[];
  deleteCustomerPoints?: CustomerPointId[];
  putCurves?: Curves;
  putPatterns?: Patterns;
  putCustomAttributesDefinition?: CustomAttributesDefinition;
};

export type ModelMoment = OptionalMomentFields & {
  note: string;
  deleteAssets?: AssetId[];
  putAssets?: Asset[];
  patchAssetsAttributes?: AssetPatch[];
};

export type ReverseMoment = OptionalMomentFields & {
  note: string;
  deleteAssets: AssetId[];
  putAssets: Asset[];
  patchAssetsAttributes: AssetPatch[];
  putCustomerPoints: CustomerPoint[];
};

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ModelMoment;
