import {
  WHOLE_VALUE,
  effective,
  isAssetEntity,
  type AssetEntityKind,
  type Cell,
  type ChangeSet,
  type Direction,
  type Effective,
} from "@epanet-js/change-set";
import type { CustomAttributesDefinitionData } from "../schema/custom-attributes-definition";
import {
  emptyApplyMomentPayload,
  type ApplyMomentPayload,
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
  payload: ApplyMomentPayload,
  entity: AssetEntityKind,
  id: number,
  step: Effective,
): void => {
  const spec = ASSET_SPECS[entity];

  if (step.kind === "delete") {
    payload.assetDeleteIds.push(id);
    return;
  }

  if (step.kind === "create") {
    const candidate = rowFrom(id, step.fields, spec.map);
    candidate.custom_attributes = customAttributesFrom(step.fields);
    (payload.assetUpserts[spec.table] as unknown[]).push(candidate);
    return;
  }

  const candidate = patchFrom(id, step.fields, spec.map);
  if (hasColumns(candidate)) {
    (payload.assetPatches[spec.table] as unknown[]).push(candidate);
  }

  const delta = customAttributesDelta(step.fields);
  if (delta !== null) {
    payload.customAttributeValues[spec.table].push({ id, delta });
  }
};

const addCustomerPoint = (
  payload: ApplyMomentPayload,
  id: number,
  step: Effective,
): void => {
  if (step.kind === "delete") {
    payload.customerPointDeleteIds.push(id);
    return;
  }

  if (step.kind === "create") {
    const candidate = rowFrom(id, step.fields, customerPointMap);
    candidate.custom_attributes = customAttributesFrom(step.fields);
    payload.customerPointUpserts.push(
      candidate as (typeof payload.customerPointUpserts)[number],
    );
    return;
  }

  const candidate = patchFrom(id, step.fields, customerPointMap);
  if (hasColumns(candidate)) {
    payload.customerPointPatches.push(
      candidate as (typeof payload.customerPointPatches)[number],
    );
  }

  const delta = customAttributesDelta(step.fields);
  if (delta !== null) {
    payload.customerPointCustomAttributeValues.push({ id, delta });
  }
};

const addCurve = (
  payload: ApplyMomentPayload,
  id: number,
  step: Effective,
): void => {
  if (step.kind === "delete") {
    payload.curveDeleteIds.push(id);
    return;
  }

  if (step.kind === "create") {
    payload.curveUpserts.push(
      rowFrom(
        id,
        step.fields,
        curveMap,
      ) as (typeof payload.curveUpserts)[number],
    );
    return;
  }

  const candidate = patchFrom(id, step.fields, curveMap);
  if (!hasColumns(candidate)) return;
  payload.curvePatches.push(candidate as (typeof payload.curvePatches)[number]);
};

const addPattern = (
  payload: ApplyMomentPayload,
  id: number,
  step: Effective,
): void => {
  if (step.kind === "delete") {
    payload.patternDeleteIds.push(id);
    return;
  }

  if (step.kind === "create") {
    payload.patternUpserts.push(
      rowFrom(
        id,
        step.fields,
        patternMap,
      ) as (typeof payload.patternUpserts)[number],
    );
    return;
  }

  const candidate = patchFrom(id, step.fields, patternMap);
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

export const buildChangeSetPayload = (
  changeSet: ChangeSet,
  direction: Direction,
): ApplyMomentPayload => {
  const payload = emptyApplyMomentPayload();
  const { records } = changeSet.read();

  const deletedCustomerPointIds = new Set<number>();
  for (const record of records) {
    if (record.entity !== "customerPoint") continue;
    if (effective(record, direction).kind !== "delete") continue;
    deletedCustomerPointIds.add(Number(record.id));
  }

  for (const record of records) {
    const step = effective(record, direction);
    const id = Number(record.id);
    const entity = record.entity;

    if (isAssetEntity(entity)) {
      addAsset(payload, entity, id, step);
      continue;
    }

    switch (entity) {
      case "customerPoint":
        addCustomerPoint(payload, id, step);
        break;
      case "curve":
        addCurve(payload, id, step);
        break;
      case "pattern":
        addPattern(payload, id, step);
        break;
      case "junctionDemand":
        payload.junctionDemandUpdates.push({
          junctionId: id,
          demands: demandRows(
            "junction_id",
            id,
            wholeValueOf(step.fields) ?? [],
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
            wholeValueOf(step.fields) ?? [],
          ),
        });
        break;
      case "allControls":
        payload.controlsReplacement = JSON.stringify(wholeValueOf(step.fields));
        break;
      case "pipeLibrary":
        payload.pipeLibraryReplacement = JSON.stringify(
          wholeValueOf(step.fields),
        );
        break;
      case "rawControls":
        payload.rawControlsReplacement = JSON.stringify(
          wholeValueOf(step.fields),
        );
        break;
      case "customAttributesDefinition":
        payload.customAttributesDefinition = JSON.stringify(
          groupCustomAttributes(
            wholeValueOf<Record<string, PlainAttribute>>(step.fields) ?? {},
          ),
        );
        break;
    }
  }

  return payload;
};
