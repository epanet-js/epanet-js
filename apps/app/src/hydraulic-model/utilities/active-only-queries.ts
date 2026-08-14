import {
  AssetId,
  AssetIndexQueries,
  AssetType,
  LinkIndex,
  LinkType,
  NodeIndex,
  NodeType,
  TopologyQueries,
} from "@epanet-js/hydraulic-model";
import { AssetsMap } from "../hydraulic-model";

const isActive = (assets: AssetsMap, id: AssetId): boolean =>
  assets.get(id)?.isActive === true;

export class ActiveAssetIndex implements AssetIndexQueries {
  private linkIndexes = new Map<AssetId, LinkIndex>();
  private nodeIndexes = new Map<AssetId, NodeIndex>();
  private linkIds: AssetId[] = [];
  private nodeIds: AssetId[] = [];

  constructor(
    private assetIndex: AssetIndexQueries,
    private assets: AssetsMap,
  ) {
    for (const [id] of assetIndex.iterateLinks()) {
      if (!isActive(assets, id)) continue;
      this.linkIndexes.set(id, this.linkIds.length);
      this.linkIds.push(id);
    }
    for (const [id] of assetIndex.iterateNodes()) {
      if (!isActive(assets, id)) continue;
      this.nodeIndexes.set(id, this.nodeIds.length);
      this.nodeIds.push(id);
    }
  }

  get linkCount(): number {
    return this.linkIds.length;
  }

  get nodeCount(): number {
    return this.nodeIds.length;
  }

  get maxAssetId(): number {
    return this.assetIndex.maxAssetId;
  }

  hasLink(id: AssetId): boolean {
    return this.linkIndexes.has(id);
  }

  hasNode(id: AssetId): boolean {
    return this.nodeIndexes.has(id);
  }

  *iterateLinks(): Generator<[AssetId, LinkIndex], void, unknown> {
    for (let index = 0; index < this.linkIds.length; index++) {
      yield [this.linkIds[index], index];
    }
  }

  *iterateNodes(): Generator<[AssetId, NodeIndex], void, unknown> {
    for (let index = 0; index < this.nodeIds.length; index++) {
      yield [this.nodeIds[index], index];
    }
  }

  getLinkIndex(id: AssetId): LinkIndex | null {
    return this.linkIndexes.get(id) ?? null;
  }

  getNodeIndex(id: AssetId): NodeIndex | null {
    return this.nodeIndexes.get(id) ?? null;
  }

  getLinkId(index: LinkIndex): AssetId | null {
    return this.linkIds[index] ?? null;
  }

  getNodeId(index: NodeIndex): AssetId | null {
    return this.nodeIds[index] ?? null;
  }

  getAssetType(id: AssetId): AssetType | undefined {
    if (!this.hasLink(id) && !this.hasNode(id)) return undefined;
    return this.assetIndex.getAssetType(id);
  }

  getNodeType(id: AssetId): NodeType | undefined {
    return this.hasNode(id) ? this.assetIndex.getNodeType(id) : undefined;
  }

  getLinkType(id: AssetId): LinkType | undefined {
    return this.hasLink(id) ? this.assetIndex.getLinkType(id) : undefined;
  }
}

export class ActiveTopology implements TopologyQueries {
  constructor(
    private topology: TopologyQueries,
    private assets: AssetsMap,
  ) {}

  hasLink(linkId: AssetId): boolean {
    return isActive(this.assets, linkId) && this.topology.hasLink(linkId);
  }

  hasNode(nodeId: AssetId): boolean {
    return isActive(this.assets, nodeId) && this.topology.hasNode(nodeId);
  }

  getLinks(nodeId: AssetId): AssetId[] {
    if (!isActive(this.assets, nodeId)) return [];
    return this.topology
      .getLinks(nodeId)
      .filter((linkId) => isActive(this.assets, linkId));
  }

  getNodes(linkId: AssetId): [AssetId, AssetId] {
    return this.topology.getNodes(linkId);
  }
}
