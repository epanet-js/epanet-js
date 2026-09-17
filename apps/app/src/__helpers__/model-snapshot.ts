import type { LabelManager } from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";

export type ModelFixture = {
  model: HydraulicModel;
  labelManager: LabelManager;
};

const UNDEFINED = "\u0000undefined";

const canonical = (value: unknown): unknown => {
  if (value === undefined) return UNDEFINED;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (value instanceof Map) {
    return [...(value as Map<unknown, unknown>).entries()]
      .map(([key, entry]) => [key, canonical(entry)])
      .sort(byKey);
  }
  if (value instanceof Set) {
    return [...(value as Set<unknown>)].map(canonical);
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .map((key) => [key, canonical(source[key])]);
  }
  return value;
};

const sortKey = (value: unknown): string =>
  String(Array.isArray(value) ? value[0] : value);

const byKey = (a: unknown, b: unknown): number =>
  sortKey(a) < sortKey(b) ? -1 : 1;

const sortedEntries = <K, V>(map: ReadonlyMap<K, V>): unknown =>
  [...map.entries()].map(([key, value]) => [key, canonical(value)]).sort(byKey);

export type ModelSnapshot = ReturnType<typeof snapshot>;

export const withoutIndexOrder = (snap: ModelSnapshot) => ({
  ...snap,
  index: {
    links: snap.index.links.map(([id]) => id).sort(),
    nodes: snap.index.nodes.map(([id]) => id).sort(),
  },
});

export const modelLabels = (model: HydraulicModel): string[] => [
  ...[...model.assets.values()].map((asset) => asset.label),
  ...[...model.customerPoints.values()].map((point) => point.label),
  ...[...model.curves.values()].map((curve) => curve.label),
  ...[...model.patterns.values()].map((pattern) => pattern.label),
];

export const snapshot = (
  { model, labelManager }: ModelFixture,
  labelProbe: readonly string[] = [],
) => ({
  assets: [...model.assets.values()]
    .map((asset) => [asset.id, asset.type, canonical(asset.feature)])
    .sort(byKey),
  customerPoints: [...model.customerPoints.values()]
    .map((point) => [
      point.id,
      canonical(point.coordinates),
      point.label,
      canonical(point.connection),
    ])
    .sort(byKey),
  demands: {
    junctions: sortedEntries(model.demands.junctions),
    customerPoints: sortedEntries(model.demands.customerPoints),
  },
  curves: sortedEntries(model.curves),
  patterns: sortedEntries(model.patterns),
  controls: [...model.controls]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(canonical),
  rawControls: canonical(model.rawControls),
  pipeMaterials: canonical(model.pipeMaterials),
  customAttributes: canonical(model.customAttributes),
  topology: [...model.assets.values()]
    .filter((asset) => asset.isLink)
    .map((asset) => [asset.id, model.topology.getNodes(asset.id)])
    .sort(byKey),
  index: {
    links: [...model.assetIndex.iterateLinks()],
    nodes: [...model.assetIndex.iterateNodes()],
  },
  customerPointsLookup: [...model.customerPointsLookup.entries()]
    .map(([assetId, points]) => [
      assetId,
      [...points].map((point) => point.id).sort(),
    ])
    .sort(byKey),
  labels: [...new Set([...modelLabels(model), ...labelProbe])]
    .sort()
    .map((label) => [label, labelManager.count(label)]),
});
