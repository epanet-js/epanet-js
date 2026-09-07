import type { z } from "zod";
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
import {
  junctionRowSchema,
  reservoirRowSchema,
  tankRowSchema,
  pipeRowSchema,
  pumpRowSchema,
  valveRowSchema,
} from "../schema/assets";
import {
  junctionPatchRowSchema,
  reservoirPatchRowSchema,
  tankPatchRowSchema,
  pipePatchRowSchema,
  pumpPatchRowSchema,
  valvePatchRowSchema,
  customerPointPatchRowSchema,
  curvePatchRowSchema,
  patternPatchRowSchema,
} from "../schema/patches";
import { customerPointRowSchema } from "../schema/customer-points";
import { curveRowSchema } from "../schema/curves";
import { patternRowSchema } from "../schema/patterns";
import { controlsSchema } from "../schema/controls";
import { rawControlsSchema } from "../schema/raw-controls";
import { pipeLibrarySchema } from "../schema/pipe-library";
import {
  customAttributesDefinitionSchema,
  type CustomAttributesDefinitionData,
} from "../schema/custom-attributes-definition";
import { junctionDemandRowSchema } from "../schema/junction-demands";
import { customerPointDemandRowSchema } from "../schema/customer-points";
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
  kind: string;
  rowSchema: z.ZodTypeAny;
  patchSchema: z.ZodTypeAny;
  map: AnyColumnMap;
};

const ASSET_SPECS: Record<AssetEntityKind, AssetSpec> = {
  junction: {
    table: "junctions",
    kind: "Junction",
    rowSchema: junctionRowSchema,
    patchSchema: junctionPatchRowSchema,
    map: junctionMap as AnyColumnMap,
  },
  reservoir: {
    table: "reservoirs",
    kind: "Reservoir",
    rowSchema: reservoirRowSchema,
    patchSchema: reservoirPatchRowSchema,
    map: reservoirMap as AnyColumnMap,
  },
  tank: {
    table: "tanks",
    kind: "Tank",
    rowSchema: tankRowSchema,
    patchSchema: tankPatchRowSchema,
    map: tankMap as AnyColumnMap,
  },
  pipe: {
    table: "pipes",
    kind: "Pipe",
    rowSchema: pipeRowSchema,
    patchSchema: pipePatchRowSchema,
    map: pipeMap as AnyColumnMap,
  },
  pump: {
    table: "pumps",
    kind: "Pump",
    rowSchema: pumpRowSchema,
    patchSchema: pumpPatchRowSchema,
    map: pumpMap as AnyColumnMap,
  },
  valve: {
    table: "valves",
    kind: "Valve",
    rowSchema: valveRowSchema,
    patchSchema: valvePatchRowSchema,
    map: valveMap as AnyColumnMap,
  },
};

const parseRow = (
  schema: z.ZodTypeAny,
  candidate: Record<string, unknown>,
  kind: string,
  id: number,
): unknown => {
  const result = schema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `${kind} ${id}: row does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};

const serialize = (
  schema: z.ZodTypeAny,
  value: unknown,
  kind: string,
): string => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `${kind}: data does not match schema — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
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
    const row = parseRow(spec.rowSchema, candidate, spec.kind, id);
    (payload.assetUpserts[spec.table] as unknown[]).push(row);
    return;
  }

  const candidate = patchFrom(id, step.fields, spec.map);
  if (hasColumns(candidate)) {
    const patch = parseRow(spec.patchSchema, candidate, spec.kind, id);
    (payload.assetPatches[spec.table] as unknown[]).push(patch);
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
      parseRow(
        customerPointRowSchema,
        candidate,
        "CustomerPoint",
        id,
      ) as (typeof payload.customerPointUpserts)[number],
    );
    return;
  }

  const candidate = patchFrom(id, step.fields, customerPointMap);
  if (hasColumns(candidate)) {
    payload.customerPointPatches.push(
      parseRow(
        customerPointPatchRowSchema,
        candidate,
        "CustomerPoint",
        id,
      ) as (typeof payload.customerPointPatches)[number],
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
      parseRow(
        curveRowSchema,
        rowFrom(id, step.fields, curveMap),
        "Curve",
        id,
      ) as (typeof payload.curveUpserts)[number],
    );
    return;
  }

  const candidate = patchFrom(id, step.fields, curveMap);
  if (!hasColumns(candidate)) return;
  payload.curvePatches.push(
    parseRow(
      curvePatchRowSchema,
      candidate,
      "Curve",
      id,
    ) as (typeof payload.curvePatches)[number],
  );
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
      parseRow(
        patternRowSchema,
        rowFrom(id, step.fields, patternMap),
        "Pattern",
        id,
      ) as (typeof payload.patternUpserts)[number],
    );
    return;
  }

  const candidate = patchFrom(id, step.fields, patternMap);
  if (!hasColumns(candidate)) return;
  payload.patternPatches.push(
    parseRow(
      patternPatchRowSchema,
      candidate,
      "Pattern",
      id,
    ) as (typeof payload.patternPatches)[number],
  );
};

const demandRows = <T>(
  schema: z.ZodTypeAny,
  ownerColumn: "junction_id" | "customer_point_id",
  ownerId: number,
  demands: { baseDemand: number; patternId?: number | null }[],
): T[] =>
  demands.map((demand, ordinal) => {
    const candidate = {
      [ownerColumn]: ownerId,
      ordinal,
      base_demand: demand.baseDemand,
      pattern_id: demand.patternId ?? null,
    };
    const result = schema.safeParse(candidate);
    if (!result.success) {
      throw new Error(
        `Demand ${ownerId}/${ordinal}: row does not match schema — ${result.error.message}`,
      );
    }
    return result.data as T;
  });

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
            junctionDemandRowSchema,
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
            customerPointDemandRowSchema,
            "customer_point_id",
            id,
            wholeValueOf(step.fields) ?? [],
          ),
        });
        break;
      case "allControls":
        payload.controlsReplacement = serialize(
          controlsSchema,
          wholeValueOf(step.fields),
          "Controls",
        );
        break;
      case "pipeLibrary":
        payload.pipeLibraryReplacement = serialize(
          pipeLibrarySchema,
          wholeValueOf(step.fields),
          "Pipe library",
        );
        break;
      case "rawControls":
        payload.rawControlsReplacement = serialize(
          rawControlsSchema,
          wholeValueOf(step.fields),
          "Controls",
        );
        break;
      case "customAttributesDefinition":
        payload.customAttributesDefinition = serialize(
          customAttributesDefinitionSchema,
          groupCustomAttributes(
            wholeValueOf<Record<string, PlainAttribute>>(step.fields) ?? {},
          ),
          "Custom attributes",
        );
        break;
    }
  }

  return payload;
};
