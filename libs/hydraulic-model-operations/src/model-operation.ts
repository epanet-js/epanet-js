import type { ChangeSet } from "@epanet-js/change-set";
import {
  HydraulicModel,
  type AssetPropertiesMap,
  CustomerPointId,
  Demand,
  type AssetId,
  type ZoneId,
} from "@epanet-js/hydraulic-model";

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

export type ZonePatch = {
  id: ZoneId;
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
  | "changeZoneProperties"
  | "changeZoneProperty"
  | "changeZones"
  | "connectCustomers"
  | "deactivateAssets"
  | "deleteAssets"
  | "deleteSelection"
  | "disconnectCustomers"
  | "editAssetTable"
  | "editCustomerPointTable"
  | "editZoneTable"
  | "mergeNodes"
  | "moveCustomerPoint"
  | "moveNode"
  | "removeCustomerPoints"
  | "removeZones"
  | "replaceLink"
  | "replaceNode"
  | "reverseLink";

export type ModelOperation<T> = (model: HydraulicModel, data: T) => ChangeSet;
