import {
  WHOLE_VALUE,
  effective,
  effectiveChanges,
  entityKinds,
  isAssetEntity,
  type ChangeSet,
  type Direction,
  type Effective,
  type EntityChange,
  type EntityKind,
} from "@epanet-js/change-set";
import {
  buildControlsLookup,
  type AssetId,
  type Controls,
  type CurvePoint,
  type CurveType,
  type Curves,
  type Demand,
  type ICurve,
  type LabelManager,
  type LinkAsset,
  type Pattern,
  type PatternType,
  type PipeMaterial,
  type RawControls,
} from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "../hydraulic-model";
import {
  CONNECTIONS_FIELD,
  LABEL_FIELD,
  assetToFields,
  buildAssetFromFields,
  buildCustomerPointFromFields,
  customerPointToFields,
  entityToAssetType,
  customAttributesFromPlain,
  type PlainCustomAttributes,
  type Fields,
} from "./entities";

export type ApplyReport = {
  name: string;
  direction: Direction;
  recordCount: number;
  touchedEntities: Set<EntityKind>;
  touchedAssetIds: AssetId[];
};

const CREATE_RANK: Record<EntityKind, number> = {
  pipeLibrary: 0,
  rawControls: 1,
  customAttributesDefinition: 2,
  curve: 3,
  pattern: 4,
  junction: 5,
  reservoir: 6,
  tank: 7,
  pipe: 8,
  pump: 9,
  valve: 10,
  customerPoint: 11,
  allControls: 12,
  junctionDemand: 13,
  customerDemand: 14,
};

const CREATE_ORDER: EntityKind[] = [...entityKinds].sort(
  (a, b) => CREATE_RANK[a] - CREATE_RANK[b],
);

const DELETE_ORDER: EntityKind[] = [...CREATE_ORDER].reverse();

const wholeValueOf = <T>(fields: Fields): T => fields[WHOLE_VALUE] as T;

const linkConnections = (fields: Fields): [AssetId, AssetId] | null => {
  const connections = fields[CONNECTIONS_FIELD];
  return Array.isArray(connections)
    ? (connections as [AssetId, AssetId])
    : null;
};

const applyAsset = (
  model: HydraulicModel,
  labelManager: LabelManager,
  entity: EntityKind,
  entityId: number | string,
  change: Effective,
): void => {
  if (!isAssetEntity(entity)) return;
  const id = Number(entityId);
  const type = entityToAssetType(entity);

  if (change.kind === "delete") {
    const asset = model.assets.get(id);
    if (!asset) return;
    if (asset.isLink) model.assetIndex.removeLink(id);
    else model.assetIndex.removeNode(id);
    model.assets.delete(id);
    model.topology.removeNode(id);
    model.topology.removeLink(id);
    labelManager.remove(asset.label, asset.type, id);
    return;
  }

  if (change.kind === "create") {
    const asset = buildAssetFromFields(entity, id, change.fields);
    model.assets.set(id, asset);
    if (asset.isLink) {
      model.assetIndex.addLink(id);
      const connections = linkConnections(change.fields);
      if (connections) {
        model.topology.addLink(id, connections[0], connections[1]);
      }
    } else {
      model.assetIndex.addNode(id);
    }
    labelManager.register(asset.label, type, id);
    return;
  }

  const existing = model.assets.get(id);
  if (!existing) return;

  const updated = buildAssetFromFields(entity, id, {
    ...assetToFields(existing),
    ...change.fields,
  });
  model.assets.set(id, updated);

  if (LABEL_FIELD in change.fields) {
    labelManager.remove(existing.label, type, id);
    labelManager.register(updated.label, type, id);
  }

  if (CONNECTIONS_FIELD in change.fields && updated.isLink) {
    model.topology.removeLink(id);
    const connections = (updated as LinkAsset).connections;
    if (connections) model.topology.addLink(id, connections[0], connections[1]);
  }
};

const applyCustomerPoint = (
  model: HydraulicModel,
  labelManager: LabelManager,
  entityId: number | string,
  change: Effective,
): void => {
  const id = Number(entityId);

  if (change.kind === "delete") {
    const existing = model.customerPoints.get(id);
    if (!existing) return;
    model.customerPointsLookup.removeConnection(existing);
    model.customerPoints.delete(id);
    labelManager.remove(existing.label, "customerPoint", id);
    return;
  }

  if (change.kind === "create") {
    const customerPoint = buildCustomerPointFromFields(id, change.fields);
    model.customerPointsLookup.addConnection(customerPoint);
    model.customerPoints.set(id, customerPoint);
    labelManager.register(customerPoint.label, "customerPoint", id);
    return;
  }

  const existing = model.customerPoints.get(id);
  if (!existing) return;

  const updated = buildCustomerPointFromFields(id, {
    ...customerPointToFields(existing),
    ...change.fields,
  });

  model.customerPointsLookup.removeConnection(existing);
  model.customerPointsLookup.addConnection(updated);
  model.customerPoints.set(id, updated);

  if (LABEL_FIELD in change.fields) {
    labelManager.remove(existing.label, "customerPoint", id);
    labelManager.register(updated.label, "customerPoint", id);
  }
};

const applyCurve = (
  labelManager: LabelManager,
  entityId: number | string,
  change: Effective,
  curves: Curves,
): void => {
  const id = Number(entityId);
  const existing = curves.get(id);
  if (existing) labelManager.remove(existing.label, "curve", id);

  if (change.kind === "delete") {
    curves.delete(id);
    return;
  }

  const source = { ...(existing ?? {}), ...change.fields };
  const curve: ICurve = {
    id,
    label: source.label as string,
    points: source.points as CurvePoint[],
    ...(source.type === undefined ? {} : { type: source.type as CurveType }),
  };
  curves.set(id, curve);
  labelManager.register(curve.label, "curve", id);
};

const applyPattern = (
  labelManager: LabelManager,
  entityId: number | string,
  change: Effective,
  patterns: Map<number, Pattern>,
): void => {
  const id = Number(entityId);
  const existing = patterns.get(id);
  if (existing) labelManager.remove(existing.label, "pattern", id);

  if (change.kind === "delete") {
    patterns.delete(id);
    return;
  }

  const source = { ...(existing ?? {}), ...change.fields };
  const pattern: Pattern = {
    id,
    label: source.label as string,
    multipliers: source.multipliers as number[],
    ...(source.type === undefined ? {} : { type: source.type as PatternType }),
  };
  patterns.set(id, pattern);
  labelManager.register(pattern.label, "pattern", id);
};

const applyDemand = (
  entityId: number | string,
  change: Effective,
  owners: Map<number, Demand[]>,
): void => {
  const id = Number(entityId);
  const demands = wholeValueOf<Demand[]>(change.fields) ?? [];
  if (demands.length === 0) owners.delete(id);
  else owners.set(id, demands);
};

const orderFor = (kind: Effective["kind"]): EntityKind[] =>
  kind === "delete" ? DELETE_ORDER : CREATE_ORDER;

type Applied = Pick<ApplyReport, "touchedEntities" | "touchedAssetIds"> & {
  count: number;
};

const applyChanges = (
  model: HydraulicModel,
  labelManager: LabelManager,
  changes: Iterable<EntityChange>,
): Applied => {
  const touchedEntities = new Set<EntityKind>();
  const touchedAssetIds: AssetId[] = [];

  let curves: Curves | null = null;
  let patterns: Map<number, Pattern> | null = null;
  let junctionDemands: Map<number, Demand[]> | null = null;
  let customerDemands: Map<number, Demand[]> | null = null;

  let count = 0;
  const buckets = new Map<string, EntityChange[]>();
  for (const item of changes) {
    count += 1;
    const key = `${item.change.kind}|${item.entity}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  for (const phase of ["create", "update", "delete"] as const) {
    for (const entity of orderFor(phase)) {
      const bucket = buckets.get(`${phase}|${entity}`);
      if (!bucket) continue;
      touchedEntities.add(entity);

      for (const { id, change } of bucket) {
        switch (entity) {
          case "junction":
          case "reservoir":
          case "tank":
          case "pipe":
          case "pump":
          case "valve":
            touchedAssetIds.push(Number(id));
            applyAsset(model, labelManager, entity, id, change);
            break;
          case "customerPoint":
            applyCustomerPoint(model, labelManager, id, change);
            break;
          case "curve":
            curves ??= new Map(model.curves);
            applyCurve(labelManager, id, change, curves);
            break;
          case "pattern":
            patterns ??= new Map(model.patterns);
            applyPattern(labelManager, id, change, patterns);
            break;
          case "allControls": {
            const next = wholeValueOf<Controls>(change.fields);
            model.controls = next;
            model.controlsLookup = buildControlsLookup(next);
            break;
          }
          case "customAttributesDefinition":
            model.customAttributes = customAttributesFromPlain(
              wholeValueOf<PlainCustomAttributes>(change.fields),
            );
            break;
          case "junctionDemand":
            junctionDemands ??= new Map(model.demands.junctions);
            applyDemand(id, change, junctionDemands);
            break;
          case "customerDemand":
            customerDemands ??= new Map(model.demands.customerPoints);
            applyDemand(id, change, customerDemands);
            break;
          case "pipeLibrary":
            model.pipeMaterials = wholeValueOf<PipeMaterial[]>(change.fields);
            break;
          case "rawControls":
            model.rawControls = wholeValueOf<RawControls>(change.fields);
            break;
        }
      }
    }
  }

  if (curves) model.curves = curves;
  if (patterns) model.patterns = patterns;
  if (junctionDemands || customerDemands) {
    model.demands = {
      ...model.demands,
      junctions: junctionDemands ?? model.demands.junctions,
      customerPoints: customerDemands ?? model.demands.customerPoints,
    };
  }

  return { touchedEntities, touchedAssetIds, count };
};

export const applyChangeSet = (
  model: HydraulicModel,
  changeSet: ChangeSet,
  direction: Direction,
  labelManager: LabelManager,
): ApplyReport => {
  const { count, ...touched } = applyChanges(
    model,
    labelManager,
    effectiveChanges(changeSet, direction),
  );
  return { name: changeSet.name, direction, recordCount: count, ...touched };
};

export const applyChangeSetDeprecated = (
  model: HydraulicModel,
  changeSet: ChangeSet,
  direction: Direction,
  labelManager: LabelManager,
): ApplyReport => {
  const { name, records } = changeSet.read();
  const { count, ...touched } = applyChanges(
    model,
    labelManager,
    records.map((record) => ({
      entity: record.entity,
      id: record.id,
      change: effective(record, direction),
    })),
  );
  return { name, direction, recordCount: count, ...touched };
};
