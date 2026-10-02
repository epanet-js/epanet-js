import {
  isAssetEntity,
  type ChangeEntry,
  type ChangeSet,
  type EntityKind,
} from "@epanet-js/change-set";
import { AssetId, LinkAsset } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "./hydraulic-model";

export type StoreInconsistency = {
  id: AssetId;
  kind: "node" | "link";
  inAssets: boolean;
  inAssetIndex: boolean;
  // null for nodes: a node with no links is legitimately absent from topology,
  // so topology presence is not a reliable existence signal for nodes.
  inTopology: boolean | null;
};

export type OrphanLinkConnection = {
  linkId: AssetId;
  linkType: string;
  startNodeId: AssetId;
  endNodeId: AssetId;
  missingNodeIds: AssetId[];
  cause: "put-link" | "deleted-node";
};

export type TopologyConnectionMismatch = {
  linkId: AssetId;
  assetConnections: [AssetId, AssetId];
  topologyConnections: [AssetId, AssetId];
};

const isNodeEntity = (entity: EntityKind) =>
  entity === "junction" || entity === "reservoir" || entity === "tank";

const assetEntries = (changeSet: ChangeSet): ChangeEntry[] =>
  [...changeSet.entries()].filter((entry) => isAssetEntity(entry.entity));

export const findOrphanLinkConnections = (
  model: HydraulicModel,
  changeSet: ChangeSet,
): OrphanLinkConnection[] => {
  const entries = assetEntries(changeSet);
  const entryById = new Map<AssetId, ChangeEntry>();
  for (const entry of entries) entryById.set(entry.id as AssetId, entry);

  const nodeExistsAfter = (id: AssetId): boolean => {
    const entry = entryById.get(id);
    if (entry) return entry.kind !== "delete" && isNodeEntity(entry.entity);
    return model.assets.get(id)?.isNode === true;
  };

  const orphans: OrphanLinkConnection[] = [];

  for (const entry of entries) {
    if (entry.kind === "delete" || isNodeEntity(entry.entity)) continue;

    const linkId = entry.id as AssetId;
    const connections =
      (entry.get("after", "connections") as [AssetId, AssetId] | undefined) ??
      (model.assets.get(linkId) as LinkAsset | undefined)?.connections;
    if (!connections) continue;

    const [startNodeId, endNodeId] = connections;
    const missingNodeIds: AssetId[] = [];
    if (!nodeExistsAfter(startNodeId)) missingNodeIds.push(startNodeId);
    if (!nodeExistsAfter(endNodeId)) missingNodeIds.push(endNodeId);
    if (missingNodeIds.length === 0) continue;

    orphans.push({
      linkId,
      linkType: entry.entity,
      startNodeId,
      endNodeId,
      missingNodeIds,
      cause: "put-link",
    });
  }

  const reported = new Set(orphans.map((orphan) => orphan.linkId));

  for (const entry of entries) {
    if (entry.kind !== "delete" || !isNodeEntity(entry.entity)) continue;

    const deletedNodeId = entry.id as AssetId;
    for (const linkId of model.topology.getLinks(deletedNodeId)) {
      if (entryById.has(linkId) || reported.has(linkId)) continue;

      const link = model.assets.get(linkId) as LinkAsset | undefined;
      if (!link?.isLink) continue;

      reported.add(linkId);
      const [startNodeId, endNodeId] = link.connections;
      orphans.push({
        linkId,
        linkType: link.type,
        startNodeId,
        endNodeId,
        missingNodeIds: [deletedNodeId],
        cause: "deleted-node",
      });
    }
  }

  return orphans;
};

export const findStoreInconsistencies = (
  model: HydraulicModel,
  changeSet: ChangeSet,
): StoreInconsistency[] => {
  const inconsistencies: StoreInconsistency[] = [];

  for (const entry of assetEntries(changeSet)) {
    const id = entry.id as AssetId;
    const inAssets = model.assets.has(id);

    if (isNodeEntity(entry.entity)) {
      const inAssetIndex = model.assetIndex.hasNode(id);
      if (!uniform([inAssets, inAssetIndex])) {
        inconsistencies.push({
          id,
          kind: "node",
          inAssets,
          inAssetIndex,
          inTopology: null,
        });
      }
    } else {
      const inAssetIndex = model.assetIndex.hasLink(id);
      const inTopology = model.topology.hasLink(id);
      if (!uniform([inAssets, inAssetIndex, inTopology])) {
        inconsistencies.push({
          id,
          kind: "link",
          inAssets,
          inAssetIndex,
          inTopology,
        });
      }
    }
  }

  return inconsistencies;
};

const uniform = (values: boolean[]): boolean =>
  values.every((v) => v) || values.every((v) => !v);

export const findTopologyConnectionMismatches = (
  model: HydraulicModel,
  changeSet: ChangeSet,
): TopologyConnectionMismatch[] => {
  const mismatches: TopologyConnectionMismatch[] = [];

  for (const entry of assetEntries(changeSet)) {
    if (entry.kind === "delete" || isNodeEntity(entry.entity)) continue;

    const link = model.assets.get(entry.id as AssetId) as LinkAsset | undefined;
    if (!link?.isLink || !model.topology.hasLink(link.id)) continue;

    const [startNodeId, endNodeId] = link.connections;
    const [topologyStartNodeId, topologyEndNodeId] = model.topology.getNodes(
      link.id,
    );

    if (
      startNodeId !== topologyStartNodeId ||
      endNodeId !== topologyEndNodeId
    ) {
      mismatches.push({
        linkId: link.id,
        assetConnections: [startNodeId, endNodeId],
        topologyConnections: [topologyStartNodeId, topologyEndNodeId],
      });
    }
  }

  return mismatches;
};
