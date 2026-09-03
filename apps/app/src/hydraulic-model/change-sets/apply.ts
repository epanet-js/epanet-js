import {
  WHOLE_VALUE,
  entityKinds,
  isAssetEntity,
  type ChangeRecord,
  type ChangeSet,
  type EntityKind,
} from "@epanet-js/change-set";
import {
  buildControlsLookup,
  deepCloneCustomAttributes,
  type AssetId,
  type Control,
  type Controls,
  type CurvePoint,
  type CurveType,
  type Curves,
  type CustomAttribute,
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
  splitCustomAttributeKey,
  type Fields,
} from "./entities";

export type Direction = "forward" | "reverse";

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
  customAttribute: 2,
  curve: 3,
  pattern: 4,
  junction: 5,
  reservoir: 6,
  tank: 7,
  pipe: 8,
  pump: 9,
  valve: 10,
  customerPoint: 11,
  control: 12,
  junctionDemand: 13,
  customerDemand: 14,
};

const CREATE_ORDER: EntityKind[] = [...entityKinds].sort(
  (a, b) => CREATE_RANK[a] - CREATE_RANK[b],
);

const DELETE_ORDER: EntityKind[] = [...CREATE_ORDER].reverse();

type Effective = { kind: "create" | "update" | "delete"; fields: Fields };

const effective = (record: ChangeRecord, direction: Direction): Effective => {
  if (direction === "forward") {
    if (record.kind === "create") {
      return { kind: "create", fields: record.after };
    }
    if (record.kind === "delete") {
      return { kind: "delete", fields: record.before };
    }
    return { kind: "update", fields: record.after };
  }
  if (record.kind === "create") return { kind: "delete", fields: record.after };
  if (record.kind === "delete") {
    return { kind: "create", fields: record.before };
  }
  return { kind: "update", fields: record.before };
};

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
  record: ChangeRecord,
  step: Effective,
): void => {
  const entity = record.entity;
  if (!isAssetEntity(entity)) return;
  const id = Number(record.id);
  const type = entityToAssetType(entity);

  if (step.kind === "delete") {
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

  if (step.kind === "create") {
    const asset = buildAssetFromFields(entity, id, step.fields);
    model.assets.set(id, asset);
    if (asset.isLink) {
      model.assetIndex.addLink(id);
      const connections = linkConnections(step.fields);
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
    ...step.fields,
  });
  model.assets.set(id, updated);

  if (LABEL_FIELD in step.fields) {
    labelManager.remove(existing.label, type, id);
    labelManager.register(updated.label, type, id);
  }

  if (CONNECTIONS_FIELD in step.fields && updated.isLink) {
    model.topology.removeLink(id);
    const connections = (updated as LinkAsset).connections;
    if (connections) model.topology.addLink(id, connections[0], connections[1]);
  }
};

const applyCustomerPoint = (
  model: HydraulicModel,
  labelManager: LabelManager,
  record: ChangeRecord,
  step: Effective,
): void => {
  const id = Number(record.id);

  if (step.kind === "delete") {
    const existing = model.customerPoints.get(id);
    if (!existing) return;
    model.customerPointsLookup.removeConnection(existing);
    model.customerPoints.delete(id);
    labelManager.remove(existing.label, "customerPoint", id);
    return;
  }

  if (step.kind === "create") {
    const customerPoint = buildCustomerPointFromFields(id, step.fields);
    model.customerPointsLookup.addConnection(customerPoint);
    model.customerPoints.set(id, customerPoint);
    labelManager.register(customerPoint.label, "customerPoint", id);
    return;
  }

  const existing = model.customerPoints.get(id);
  if (!existing) return;

  const updated = buildCustomerPointFromFields(id, {
    ...customerPointToFields(existing),
    ...step.fields,
  });

  model.customerPointsLookup.removeConnection(existing);
  model.customerPointsLookup.addConnection(updated);
  model.customerPoints.set(id, updated);

  if (LABEL_FIELD in step.fields) {
    labelManager.remove(existing.label, "customerPoint", id);
    labelManager.register(updated.label, "customerPoint", id);
  }
};

const applyCurve = (
  labelManager: LabelManager,
  record: ChangeRecord,
  step: Effective,
  curves: Curves,
): void => {
  const id = Number(record.id);
  const existing = curves.get(id);
  if (existing) labelManager.remove(existing.label, "curve", id);

  if (step.kind === "delete") {
    curves.delete(id);
    return;
  }

  const source = { ...(existing ?? {}), ...step.fields };
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
  record: ChangeRecord,
  step: Effective,
  patterns: Map<number, Pattern>,
): void => {
  const id = Number(record.id);
  const existing = patterns.get(id);
  if (existing) labelManager.remove(existing.label, "pattern", id);

  if (step.kind === "delete") {
    patterns.delete(id);
    return;
  }

  const source = { ...(existing ?? {}), ...step.fields };
  const pattern: Pattern = {
    id,
    label: source.label as string,
    multipliers: source.multipliers as number[],
    ...(source.type === undefined ? {} : { type: source.type as PatternType }),
  };
  patterns.set(id, pattern);
  labelManager.register(pattern.label, "pattern", id);
};

const applyControl = (
  record: ChangeRecord,
  step: Effective,
  controls: Map<string, Control>,
): void => {
  const id = String(record.id);
  if (step.kind === "delete") {
    controls.delete(id);
    return;
  }
  controls.set(id, wholeValueOf<Control>(step.fields));
};

const applyCustomAttribute = (
  record: ChangeRecord,
  step: Effective,
  definition: HydraulicModel["customAttributes"],
): void => {
  const { assetType, id } = splitCustomAttributeKey(String(record.id));

  if (step.kind === "delete") {
    const byId = definition.get(assetType);
    if (!byId) return;
    byId.delete(id);
    if (byId.size === 0) definition.delete(assetType);
    return;
  }

  let byId = definition.get(assetType);
  if (!byId) {
    byId = new Map<string, CustomAttribute>();
    definition.set(assetType, byId);
  }
  byId.set(id, wholeValueOf<CustomAttribute>(step.fields));
};

const applyDemand = (
  record: ChangeRecord,
  step: Effective,
  owners: Map<number, Demand[]>,
): void => {
  const id = Number(record.id);
  const demands = wholeValueOf<Demand[]>(step.fields) ?? [];
  if (demands.length === 0) owners.delete(id);
  else owners.set(id, demands);
};

const orderFor = (kind: Effective["kind"]): EntityKind[] =>
  kind === "delete" ? DELETE_ORDER : CREATE_ORDER;

export const applyChangeSet = (
  model: HydraulicModel,
  changeSet: ChangeSet,
  direction: Direction,
  labelManager: LabelManager,
): ApplyReport => {
  const { name, records } = changeSet.read();

  const touchedEntities = new Set<EntityKind>();
  const touchedAssetIds: AssetId[] = [];

  let curves: Curves | null = null;
  let patterns: Map<number, Pattern> | null = null;
  let controls: Map<string, Control> | null = null;
  let customAttributes: HydraulicModel["customAttributes"] | null = null;
  let junctionDemands: Map<number, Demand[]> | null = null;
  let customerDemands: Map<number, Demand[]> | null = null;

  type Step = { record: ChangeRecord; step: Effective };
  const buckets = new Map<string, Step[]>();
  for (const record of records) {
    const step = effective(record, direction);
    const key = `${step.kind}|${record.entity}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push({ record, step });
    else buckets.set(key, [{ record, step }]);
  }

  for (const phase of ["create", "update", "delete"] as const) {
    for (const entity of orderFor(phase)) {
      const bucket = buckets.get(`${phase}|${entity}`);
      if (!bucket) continue;
      touchedEntities.add(entity);

      for (const { record, step } of bucket) {
        switch (entity) {
          case "junction":
          case "reservoir":
          case "tank":
          case "pipe":
          case "pump":
          case "valve":
            touchedAssetIds.push(Number(record.id));
            applyAsset(model, labelManager, record, step);
            break;
          case "customerPoint":
            applyCustomerPoint(model, labelManager, record, step);
            break;
          case "curve":
            curves ??= new Map(model.curves);
            applyCurve(labelManager, record, step, curves);
            break;
          case "pattern":
            patterns ??= new Map(model.patterns);
            applyPattern(labelManager, record, step, patterns);
            break;
          case "control":
            controls ??= new Map(
              model.controls.map((control) => [control.id, control]),
            );
            applyControl(record, step, controls);
            break;
          case "customAttribute":
            customAttributes ??= deepCloneCustomAttributes(
              model.customAttributes,
            );
            applyCustomAttribute(record, step, customAttributes);
            break;
          case "junctionDemand":
            junctionDemands ??= new Map(model.demands.junctions);
            applyDemand(record, step, junctionDemands);
            break;
          case "customerDemand":
            customerDemands ??= new Map(model.demands.customerPoints);
            applyDemand(record, step, customerDemands);
            break;
          case "pipeLibrary":
            model.pipeMaterials = wholeValueOf<PipeMaterial[]>(step.fields);
            break;
          case "rawControls":
            model.rawControls = wholeValueOf<RawControls>(step.fields);
            break;
        }
      }
    }
  }

  if (curves) model.curves = curves;
  if (patterns) model.patterns = patterns;
  if (controls) {
    const asList: Controls = [...controls.values()];
    model.controls = asList;
    model.controlsLookup = buildControlsLookup(asList);
  }
  if (customAttributes) model.customAttributes = customAttributes;
  if (junctionDemands || customerDemands) {
    model.demands = {
      ...model.demands,
      junctions: junctionDemands ?? model.demands.junctions,
      customerPoints: customerDemands ?? model.demands.customerPoints,
    };
  }

  return {
    name,
    direction,
    recordCount: records.length,
    touchedEntities,
    touchedAssetIds,
  };
};
