export const entityKinds = [
  "junction",
  "reservoir",
  "tank",
  "pipe",
  "pump",
  "valve",
  "customerPoint",
  "curve",
  "pattern",
  "control",
  "junctionDemand",
  "customerDemand",
  "customAttribute",
  "pipeLibrary",
  "rawControls",
] as const;

export type EntityKind = (typeof entityKinds)[number];

export const assetEntityKinds = [
  "junction",
  "reservoir",
  "tank",
  "pipe",
  "pump",
  "valve",
] as const;

export type AssetEntityKind = (typeof assetEntityKinds)[number];

export const isAssetEntity = (entity: EntityKind): entity is AssetEntityKind =>
  (assetEntityKinds as readonly string[]).includes(entity);

export type ChangeKind = "create" | "update" | "delete";

export type Cell = number | string | boolean | null | undefined | object;

export const WHOLE_VALUE = "$value";

export type ChangeRecord = {
  entity: EntityKind;
  id: number | string;
  kind: ChangeKind;
  before: Record<string, Cell>;
  after: Record<string, Cell>;
};

export type DecodedChangeSet = {
  name: string;
  version: number;
  records: ChangeRecord[];
};
