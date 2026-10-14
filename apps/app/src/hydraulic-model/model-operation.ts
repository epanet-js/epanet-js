import type { ChangeSet } from "@epanet-js/change-set";
import { HydraulicModel } from "./hydraulic-model";
import {
  type AssetPropertiesMap,
  CustomerPointId,
} from "@epanet-js/hydraulic-model";
import { Demand } from "@epanet-js/hydraulic-model";
import type { AssetId } from "@epanet-js/hydraulic-model";

type NonPatchableKeys = "type" | "connections";

export type AssetPatch = {
  [K in keyof AssetPropertiesMap]: {
    id: AssetId;
    type: K;
    properties: Partial<Omit<AssetPropertiesMap[K], NonPatchableKeys>>;
  };
}[keyof AssetPropertiesMap];

export type CustomerPointPatch = {
  id: CustomerPointId;
  properties: Record<string, unknown>;
};

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

export type OperationCode =
  | "activateAssets"
  | "addCustomerPoint"
  | "addLink"
  | "addNode"
  | "applyCustomerPointAllocation"
  | "changeAssetControl"
  | "changeCurves"
  | "changeCustomAttributesDefinition"
  | "changeCustomerPointProperties"
  | "changeCustomerPointProperty"
  | "changeDemandAssignment"
  | "changeElevations"
  | "changeLabel"
  | "changePatterns"
  | "changePipeMaterials"
  | "changeProperties"
  | "changeProperty"
  | "changeRawControls"
  | "connectCustomers"
  | "deactivateAssets"
  | "deleteAssets"
  | "deleteSelection"
  | "disconnectCustomers"
  | "editAssetTable"
  | "editCustomerPointTable"
  | "mergeNodes"
  | "moveCustomerPoint"
  | "moveNode"
  | "removeCustomerPoints"
  | "replaceLink"
  | "replaceNode"
  | "reverseLink";

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ChangeSet;
