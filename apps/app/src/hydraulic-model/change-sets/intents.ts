import {
  WHOLE_VALUE,
  type Cell,
  type ChangeRecord,
  type EntityKind,
} from "@epanet-js/change-set";
import type {
  Asset,
  AssetId,
  Control,
  Controls,
  CustomAttribute,
  CustomAttributesDefinition,
  Curves,
  CustomerPoint,
  CustomerPointId,
  Patterns,
  PipeMaterial,
  RawControls,
} from "@epanet-js/hydraulic-model";
import type { DemandAssignment } from "../model-operation";
import type { Intent } from "./build";
import {
  type Fields,
  assetToFields,
  assetTypeToEntity,
  customAttributeKey,
  customerPointToFields,
} from "./entities";

export const SINGLETON_ID = 0;

const sameValue = (a: Cell, b: Cell): boolean => {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) {
    return false;
  }
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
};

export const diffFields = (
  current: Fields,
  next: Fields,
): { before: Fields; after: Fields; changed: boolean } => {
  const before: Fields = {};
  const after: Fields = {};
  let changed = false;

  const fields = new Set([...Object.keys(current), ...Object.keys(next)]);
  for (const field of fields) {
    if (sameValue(current[field], next[field])) continue;
    before[field] = current[field];
    after[field] = next[field];
    changed = true;
  }

  return { before, after, changed };
};

const asArray = <T>(value: T | readonly T[]): readonly T[] =>
  Array.isArray(value) ? (value as readonly T[]) : ([value] as readonly T[]);

const wholeValue = (value: unknown): Fields => ({
  [WHOLE_VALUE]: value as Cell,
});

export const putAsset =
  (asset: Asset): Intent =>
  (model, out) => {
    const entity = assetTypeToEntity(asset.type);
    const next = assetToFields(asset);
    const existing = model.assets.get(asset.id);

    if (!existing) {
      out.push({
        entity,
        id: asset.id,
        kind: "create",
        before: {},
        after: next,
      });
      return;
    }

    const { before, after, changed } = diffFields(
      assetToFields(existing),
      next,
    );
    if (!changed) return;
    out.push({ entity, id: asset.id, kind: "update", before, after });
  };

export const putAssets =
  (assets: readonly Asset[]): Intent =>
  (model, out) => {
    for (const asset of assets) putAsset(asset)(model, out);
  };

export const setAsset =
  (ids: AssetId | readonly AssetId[], fields: Fields): Intent =>
  (model, out) => {
    for (const id of asArray(ids)) {
      const asset = model.assets.get(id);
      if (!asset) continue;

      const current: Fields = {};
      for (const field of Object.keys(fields)) {
        current[field] = asset.getProperty(field) as Cell;
      }

      const { before, after, changed } = diffFields(current, fields);
      if (!changed) continue;
      out.push({
        entity: assetTypeToEntity(asset.type),
        id,
        kind: "update",
        before,
        after,
      });
    }
  };

export const dropAssets =
  (ids: AssetId | readonly AssetId[]): Intent =>
  (model, out) => {
    for (const id of asArray(ids)) {
      const asset = model.assets.get(id);
      if (!asset) continue;
      out.push({
        entity: assetTypeToEntity(asset.type),
        id,
        kind: "delete",
        before: assetToFields(asset),
        after: {},
      });
    }
  };

export const putCustomerPoints =
  (customerPoints: readonly CustomerPoint[]): Intent =>
  (model, out) => {
    for (const customerPoint of customerPoints) {
      const next = customerPointToFields(customerPoint);
      const existing = model.customerPoints.get(customerPoint.id);

      if (!existing) {
        out.push({
          entity: "customerPoint",
          id: customerPoint.id,
          kind: "create",
          before: {},
          after: next,
        });
        continue;
      }

      const { before, after, changed } = diffFields(
        customerPointToFields(existing),
        next,
      );
      if (!changed) continue;
      out.push({
        entity: "customerPoint",
        id: customerPoint.id,
        kind: "update",
        before,
        after,
      });
    }
  };

export const setCustomerPoint =
  (ids: CustomerPointId | readonly CustomerPointId[], fields: Fields): Intent =>
  (model, out) => {
    for (const id of asArray(ids)) {
      const customerPoint = model.customerPoints.get(id);
      if (!customerPoint) continue;

      const current: Fields = {};
      for (const field of Object.keys(fields)) {
        current[field] = customerPoint.getProperty(field) as Cell;
      }

      const { before, after, changed } = diffFields(current, fields);
      if (!changed) continue;
      out.push({ entity: "customerPoint", id, kind: "update", before, after });
    }
  };

export const dropCustomerPoints =
  (ids: CustomerPointId | readonly CustomerPointId[]): Intent =>
  (model, out) => {
    for (const id of asArray(ids)) {
      const customerPoint = model.customerPoints.get(id);
      if (!customerPoint) continue;
      out.push({
        entity: "customerPoint",
        id,
        kind: "delete",
        before: customerPointToFields(customerPoint),
        after: {},
      });
    }
  };

const diffKeyed = <K extends number | string, V>(
  entity: EntityKind,
  current: ReadonlyMap<K, V>,
  next: ReadonlyMap<K, V>,
  toFields: (value: V) => Fields,
  out: ChangeRecord[],
): void => {
  for (const [id, value] of next) {
    const existing = current.get(id);
    const fields = toFields(value);

    if (existing === undefined) {
      out.push({ entity, id, kind: "create", before: {}, after: fields });
      continue;
    }

    const { before, after, changed } = diffFields(toFields(existing), fields);
    if (!changed) continue;
    out.push({ entity, id, kind: "update", before, after });
  }

  for (const [id, value] of current) {
    if (next.has(id)) continue;
    out.push({
      entity,
      id,
      kind: "delete",
      before: toFields(value),
      after: {},
    });
  }
};

export const replaceCurves =
  (curves: Curves): Intent =>
  (model, out) => {
    diffKeyed(
      "curve",
      model.curves,
      curves,
      (curve) => ({
        label: curve.label,
        type: curve.type,
        points: curve.points,
      }),
      out,
    );
  };

export const replacePatterns =
  (patterns: Patterns): Intent =>
  (model, out) => {
    diffKeyed(
      "pattern",
      model.patterns,
      patterns,
      (pattern) => ({
        label: pattern.label,
        type: pattern.type,
        multipliers: pattern.multipliers,
      }),
      out,
    );
  };

const controlsById = (controls: Controls): Map<string, Control> =>
  new Map(controls.map((control) => [control.id, control]));

export const replaceControls =
  (controls: Controls): Intent =>
  (model, out) => {
    diffKeyed(
      "control",
      controlsById(model.controls),
      controlsById(controls),
      wholeValue,
      out,
    );
  };

const flattenCustomAttributes = (
  definition: CustomAttributesDefinition,
): Map<string, CustomAttribute> => {
  const flat = new Map<string, CustomAttribute>();
  for (const [assetType, byId] of definition) {
    for (const [id, attribute] of byId) {
      flat.set(customAttributeKey(assetType, id), attribute);
    }
  }
  return flat;
};

export const replaceCustomAttributes =
  (definition: CustomAttributesDefinition): Intent =>
  (model, out) => {
    diffKeyed(
      "customAttribute",
      flattenCustomAttributes(model.customAttributes),
      flattenCustomAttributes(definition),
      wholeValue,
      out,
    );
  };

const putSingleton = (
  entity: EntityKind,
  current: unknown,
  next: unknown,
  out: ChangeRecord[],
): void => {
  if (sameValue(current as Cell, next as Cell)) return;
  out.push({
    entity,
    id: SINGLETON_ID,
    kind: "update",
    before: wholeValue(current),
    after: wholeValue(next),
  });
};

export const setPipeLibrary =
  (materials: PipeMaterial[]): Intent =>
  (model, out) => {
    putSingleton("pipeLibrary", model.pipeMaterials, materials, out);
  };

export const setRawControls =
  (rawControls: RawControls): Intent =>
  (model, out) => {
    putSingleton("rawControls", model.rawControls, rawControls, out);
  };

export const setDemands =
  (assignments: readonly DemandAssignment[]): Intent =>
  (model, out) => {
    for (const assignment of assignments) {
      const isCustomer = "customerPointId" in assignment;
      const entity: EntityKind = isCustomer
        ? "customerDemand"
        : "junctionDemand";
      const id = isCustomer
        ? assignment.customerPointId
        : assignment.junctionId;
      const current =
        (isCustomer
          ? model.demands.customerPoints.get(id)
          : model.demands.junctions.get(id)) ?? [];

      if (sameValue(current, assignment.demands)) continue;
      out.push({
        entity,
        id,
        kind: "update",
        before: wholeValue(current),
        after: wholeValue(assignment.demands),
      });
    }
  };
