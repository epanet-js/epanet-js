import { Asset, AssetId, LinkAsset } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "./hydraulic-model";
import { ModelMoment } from "./model-operation";

export type AssetKind = "node" | "link" | "unknown";

export type StoreInconsistency = {
  id: AssetId;
  kind: AssetKind;
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

export const findStoreInconsistencies = (
  model: HydraulicModel,
  moment: ModelMoment,
): StoreInconsistency[] => {
  const affectedIds = new Set<AssetId>();
  for (const asset of moment.putAssets ?? []) affectedIds.add(asset.id);
  for (const id of moment.deleteAssets ?? []) affectedIds.add(id);

  const putById = new Map<AssetId, Asset>();
  for (const asset of moment.putAssets ?? []) putById.set(asset.id, asset);

  const inconsistencies: StoreInconsistency[] = [];

  for (const id of affectedIds) {
    const kind = classify(model, putById.get(id), id);
    const inAssets = model.assets.has(id);

    if (kind === "link") {
      const inAssetIndex = model.assetIndex.hasLink(id);
      const inTopology = model.topology.hasLink(id);
      if (!uniform([inAssets, inAssetIndex, inTopology])) {
        inconsistencies.push({ id, kind, inAssets, inAssetIndex, inTopology });
      }
    } else if (kind === "node") {
      const inAssetIndex = model.assetIndex.hasNode(id);
      if (!uniform([inAssets, inAssetIndex])) {
        inconsistencies.push({
          id,
          kind,
          inAssets,
          inAssetIndex,
          inTopology: null,
        });
      }
    }
    // "unknown" means absent from every store: uniformly absent → consistent.
  }

  return inconsistencies;
};

const classify = (
  model: HydraulicModel,
  putAsset: Asset | undefined,
  id: AssetId,
): AssetKind => {
  if (putAsset) return putAsset.isNode ? "node" : "link";

  const existing = model.assets.get(id);
  if (existing) return existing.isNode ? "node" : "link";

  if (model.assetIndex.hasLink(id)) return "link";
  if (model.assetIndex.hasNode(id)) return "node";
  if (model.topology.hasLink(id)) return "link";

  return "unknown";
};

const uniform = (values: boolean[]): boolean =>
  values.every((v) => v) || values.every((v) => !v);

export const findOrphanLinkConnections = (
  model: HydraulicModel,
  moment: ModelMoment,
): OrphanLinkConnection[] => {
  const deletedIds = new Set<AssetId>(moment.deleteAssets ?? []);
  const putById = new Map<AssetId, Asset>();
  for (const asset of moment.putAssets ?? []) putById.set(asset.id, asset);

  const nodeExistsAfter = (id: AssetId): boolean => {
    const put = putById.get(id);
    if (put) return put.isNode;
    if (deletedIds.has(id)) return false;
    return model.assets.get(id)?.isNode === true;
  };

  const orphans: OrphanLinkConnection[] = [];
  const reported = new Set<AssetId>();

  const add = (
    link: LinkAsset,
    missingNodeIds: AssetId[],
    cause: OrphanLinkConnection["cause"],
  ) => {
    if (reported.has(link.id)) return;
    reported.add(link.id);
    const [startNodeId, endNodeId] = link.connections;
    orphans.push({
      linkId: link.id,
      linkType: link.type,
      startNodeId,
      endNodeId,
      missingNodeIds,
      cause,
    });
  };

  for (const asset of putById.values()) {
    if (!asset.isLink) continue;
    const link = asset as LinkAsset;
    const [startNodeId, endNodeId] = link.connections;
    const missingNodeIds: AssetId[] = [];
    if (!nodeExistsAfter(startNodeId)) missingNodeIds.push(startNodeId);
    if (!nodeExistsAfter(endNodeId)) missingNodeIds.push(endNodeId);
    if (missingNodeIds.length > 0) add(link, missingNodeIds, "put-link");
  }

  for (const deletedId of deletedIds) {
    const deletedAsset = model.assets.get(deletedId);
    if (!deletedAsset || !deletedAsset.isNode) continue;

    for (const linkId of model.topology.getLinks(deletedId)) {
      if (deletedIds.has(linkId)) continue;
      if (putById.has(linkId)) continue; // rewired link is validated above

      const survivingLink = model.assets.get(linkId);
      if (survivingLink?.isLink) {
        add(survivingLink as LinkAsset, [deletedId], "deleted-node");
      }
    }
  }

  return orphans;
};
