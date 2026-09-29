import {
  WHOLE_VALUE,
  effective,
  effectiveChanges,
  isAssetEntity,
  type AssetEntityKind,
  type Cell,
  type ChangeSet,
  type Direction,
  type Effective,
  type EntityChange,
} from "@epanet-js/change-set";
import type { CustomAttributesDefinitionData } from "../schema/custom-attributes-definition";
import {
  emptyWriteBatch,
  type WriteBatch,
  type AssetCustomAttributeUpdates,
} from "../types";
import { patchFrom, rowFrom, type ColumnMap } from "./column-map";
import {
  customAttributesDelta,
  customAttributesFrom,
} from "./custom-attributes";
import {
  junctionMap,
  reservoirMap,
  tankMap,
  pipeMap,
  pumpMap,
  valveMap,
  customerPointMap,
  curveMap,
  patternMap,
} from "./columns";

type Fields = Record<string, Cell>;

type AnyColumnMap = ColumnMap<Record<string, unknown>>;

type AssetSpec = {
  table: keyof AssetCustomAttributeUpdates;
  map: AnyColumnMap;
};

const ASSET_SPECS: Record<AssetEntityKind, AssetSpec> = {
  junction: { table: "junctions", map: junctionMap as AnyColumnMap },
  reservoir: { table: "reservoirs", map: reservoirMap as AnyColumnMap },
  tank: { table: "tanks", map: tankMap as AnyColumnMap },
  pipe: { table: "pipes", map: pipeMap as AnyColumnMap },
  pump: { table: "pumps", map: pumpMap as AnyColumnMap },
  valve: { table: "valves", map: valveMap as AnyColumnMap },
};

const wholeValueOf = <T>(fields: Fields): T => fields[WHOLE_VALUE] as T;

const hasColumns = (candidate: Record<string, unknown>): boolean =>
  Object.keys(candidate).length > 1;

type PlainAttribute = { id: string; label: string; type: string };

const groupCustomAttributes = (
  plain: Record<string, PlainAttribute>,
): CustomAttributesDefinitionData => {
  const data: Record<string, PlainAttribute[]> = {};
  for (const key of Object.keys(plain)) {
    const assetType = key.slice(0, key.indexOf("/"));
    (data[assetType] ??= []).push(plain[key]);
  }
  return data as CustomAttributesDefinitionData;
};

const addAsset = (
  payload: WriteBatch,
  entity: AssetEntityKind,
  id: number,
  change: Effective,
): void => {
  const spec = ASSET_SPECS[entity];

  if (change.kind === "delete") {
    payload.assetDeleteIds.push(id);
    return;
  }

  if (change.kind === "create") {
    const candidate = rowFrom(id, change.fields, spec.map);
    candidate.custom_attributes = customAttributesFrom(change.fields);
    (payload.assetUpserts[spec.table] as unknown[]).push(candidate);
    return;
  }

  const candidate = patchFrom(id, change.fields, spec.map);
  if (hasColumns(candidate)) {
    (payload.assetPatches[spec.table] as unknown[]).push(candidate);
  }

  const delta = customAttributesDelta(change.fields);
  if (delta !== null) {
    payload.customAttributeValues[spec.table].push({ id, delta });
  }
};

const addCustomerPoint = (
  payload: WriteBatch,
  id: number,
  change: Effective,
): void => {
  if (change.kind === "delete") {
    payload.customerPointDeleteIds.push(id);
    return;
  }

  if (change.kind === "create") {
    const candidate = rowFrom(id, change.fields, customerPointMap);
    candidate.custom_attributes = customAttributesFrom(change.fields);
    payload.customerPointUpserts.push(
      candidate as (typeof payload.customerPointUpserts)[number],
    );
    return;
  }

  const candidate = patchFrom(id, change.fields, customerPointMap);
  if (hasColumns(candidate)) {
    payload.customerPointPatches.push(
      candidate as (typeof payload.customerPointPatches)[number],
    );
  }

  const delta = customAttributesDelta(change.fields);
  if (delta !== null) {
    payload.customerPointCustomAttributeValues.push({ id, delta });
  }
};

const addCurve = (payload: WriteBatch, id: number, change: Effective): void => {
  if (change.kind === "delete") {
    payload.curveDeleteIds.push(id);
    return;
  }

  if (change.kind === "create") {
    payload.curveUpserts.push(
      rowFrom(
        id,
        change.fields,
        curveMap,
      ) as (typeof payload.curveUpserts)[number],
    );
    return;
  }

  const candidate = patchFrom(id, change.fields, curveMap);
  if (!hasColumns(candidate)) return;
  payload.curvePatches.push(candidate as (typeof payload.curvePatches)[number]);
};

const addPattern = (
  payload: WriteBatch,
  id: number,
  change: Effective,
): void => {
  if (change.kind === "delete") {
    payload.patternDeleteIds.push(id);
    return;
  }

  if (change.kind === "create") {
    payload.patternUpserts.push(
      rowFrom(
        id,
        change.fields,
        patternMap,
      ) as (typeof payload.patternUpserts)[number],
    );
    return;
  }

  const candidate = patchFrom(id, change.fields, patternMap);
  if (!hasColumns(candidate)) return;
  payload.patternPatches.push(
    candidate as (typeof payload.patternPatches)[number],
  );
};

const demandRows = <T>(
  ownerColumn: "junction_id" | "customer_point_id",
  ownerId: number,
  demands: { baseDemand: number; patternId?: number | null }[],
): T[] =>
  demands.map(
    (demand, ordinal) =>
      ({
        [ownerColumn]: ownerId,
        ordinal,
        base_demand: demand.baseDemand,
        pattern_id: demand.patternId ?? null,
      }) as T,
  );

const buildPayload = (changes: readonly EntityChange[]): WriteBatch => {
  const payload = emptyWriteBatch();

  const deletedCustomerPointIds = new Set<number>();
  for (const { entity, id, change } of changes) {
    if (entity !== "customerPoint") continue;
    if (change.kind !== "delete") continue;
    deletedCustomerPointIds.add(Number(id));
  }

  for (const { entity, id: entityId, change } of changes) {
    const id = Number(entityId);

    if (isAssetEntity(entity)) {
      addAsset(payload, entity, id, change);
      continue;
    }

    switch (entity) {
      case "customerPoint":
        addCustomerPoint(payload, id, change);
        break;
      case "curve":
        addCurve(payload, id, change);
        break;
      case "pattern":
        addPattern(payload, id, change);
        break;
      case "junctionDemand":
        payload.junctionDemandUpdates.push({
          junctionId: id,
          demands: demandRows(
            "junction_id",
            id,
            wholeValueOf(change.fields) ?? [],
          ),
        });
        break;
      case "customerDemand":
        if (deletedCustomerPointIds.has(id)) break;
        payload.customerPointDemandUpdates.push({
          customerPointId: id,
          demands: demandRows(
            "customer_point_id",
            id,
            wholeValueOf(change.fields) ?? [],
          ),
        });
        break;
      case "allControls":
        payload.controlsReplacement = JSON.stringify(
          wholeValueOf(change.fields),
        );
        break;
      case "pipeLibrary":
        payload.pipeLibraryReplacement = JSON.stringify(
          wholeValueOf(change.fields),
        );
        break;
      case "rawControls":
        payload.rawControlsReplacement = JSON.stringify(
          wholeValueOf(change.fields),
        );
        break;
      case "customAttributesDefinition":
        payload.customAttributesDefinition = JSON.stringify(
          groupCustomAttributes(
            wholeValueOf<Record<string, PlainAttribute>>(change.fields) ?? {},
          ),
        );
        break;
    }
  }

  return payload;
};

export const buildChangeSetPayload = (
  changeSet: ChangeSet,
  direction: Direction,
): WriteBatch => buildPayload([...effectiveChanges(changeSet, direction)]);

export const buildChangeSetPayloadDeprecated = (
  changeSet: ChangeSet,
  direction: Direction,
): WriteBatch =>
  buildPayload(
    changeSet.read().records.map((record) => ({
      entity: record.entity,
      id: record.id,
      change: effective(record, direction),
    })),
  );
