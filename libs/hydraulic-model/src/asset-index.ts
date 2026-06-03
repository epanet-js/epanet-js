import { AssetId, AssetType, LinkType, NodeType } from "./asset-types";
import { IdGenerator } from "@epanet-js/id-generator";
import { AssetsMap } from "./assets-map";

export type LinkIndex = number;
export type NodeIndex = number;

export interface AssetIndexQueries {
  get linkCount(): number;
  get nodeCount(): number;
  get maxAssetId(): number;
  hasLink(id: AssetId): boolean;
  hasNode(id: AssetId): boolean;
  iterateLinks(): Generator<[AssetId, LinkIndex], void, unknown>;
  iterateNodes(): Generator<[AssetId, NodeIndex], void, unknown>;
  getLinkIndex(id: AssetId): number | null;
  getNodeIndex(id: AssetId): number | null;
  getNodeId(index: NodeIndex): AssetId | null;
  getLinkId(index: LinkIndex): AssetId | null;
  getAssetType(id: AssetId): AssetType | undefined;
  getNodeType(id: AssetId): NodeType | undefined;
  getLinkType(id: AssetId): LinkType | undefined;
}

export class AssetIndex implements AssetIndexQueries {
  private linkIds: Set<AssetId> = new Set();
  private nodeIds: Set<AssetId> = new Set();

  constructor(
    private idGenerator: IdGenerator,
    private assets: AssetsMap,
  ) {
    return;
  }

  addLink(id: AssetId): void {
    if (id === 0) {
      throw new Error("AssetId 0 is not allowed");
    }

    if (this.hasNode(id)) {
      this.removeNode(id);
    }

    this.linkIds.add(id);
  }

  addNode(id: AssetId): void {
    if (id === 0) {
      throw new Error("AssetId 0 is not allowed");
    }

    if (this.hasLink(id)) {
      this.removeLink(id);
    }

    this.nodeIds.add(id);
  }

  hasLink(id: AssetId): boolean {
    return this.linkIds.has(id);
  }

  hasNode(id: AssetId): boolean {
    return this.nodeIds.has(id);
  }

  removeLink(id: AssetId): void {
    if (!this.hasLink(id)) return;
    this.linkIds.delete(id);
  }

  removeNode(id: AssetId): void {
    if (!this.hasNode(id)) return;
    this.nodeIds.delete(id);
  }

  *iterateLinks(): Generator<[AssetId, LinkIndex], void, unknown> {
    let i = 0;
    for (const id of this.linkIds) {
      yield [id, i++];
    }
  }

  *iterateNodes(): Generator<[AssetId, NodeIndex], void, unknown> {
    let i = 0;
    for (const id of this.nodeIds) {
      yield [id, i++];
    }
  }

  getLinkIndex(id: AssetId): LinkIndex | null {
    if (id <= 0 || id >= this.linkIds.size) {
      return null;
    }
    for (const [linkId, linkIndex] of this.iterateLinks()) {
      if (linkId === id) return linkIndex;
    }
    return null;
  }

  getNodeIndex(id: AssetId): NodeIndex | null {
    if (id <= 0 || id >= this.nodeIds.size) {
      return null;
    }
    for (const [nodeId, nodeIndex] of this.iterateNodes()) {
      if (nodeId === id) return nodeIndex;
    }
    return null;
  }

  getNodeId(index: NodeIndex): AssetId | null {
    if (index < 0 || index >= this.nodeIds.size) return null;
    for (const [nodeId, nodeIndex] of this.iterateNodes()) {
      if (nodeIndex === index) return nodeId;
    }
    return null;
  }

  getLinkId(index: NodeIndex): AssetId | null {
    if (index < 0 || index >= this.linkIds.size) return null;
    for (const [linkId, linkIndex] of this.iterateLinks()) {
      if (linkIndex === index) return linkId;
    }
    return null;
  }

  get linkCount(): number {
    return this.linkIds.size;
  }

  get nodeCount(): number {
    return this.nodeIds.size;
  }

  get maxAssetId(): number {
    return this.idGenerator.totalGenerated;
  }

  getAssetType(id: AssetId): AssetType | undefined {
    const asset = this.assets.get(id);
    return asset?.type as AssetType | undefined;
  }

  getNodeType(id: AssetId): NodeType | undefined {
    const asset = this.assets.get(id);
    if (!asset || !asset.isNode) return undefined;
    return asset.type as NodeType;
  }

  getLinkType(id: AssetId): LinkType | undefined {
    const asset = this.assets.get(id);
    if (!asset || !asset.isLink) return undefined;
    return asset.type as LinkType;
  }

  updateAssets(assets: AssetsMap) {
    if (assets.size !== this.linkCount + this.nodeCount) {
      throw new Error("AssetIndex could not be updated");
    }
    this.assets = assets;
  }

  copy(assets: AssetsMap): AssetIndex {
    const copy = new AssetIndex(this.idGenerator, assets);
    for (const id of this.linkIds) {
      copy.addLink(id);
    }
    for (const id of this.nodeIds) {
      copy.addNode(id);
    }
    return copy;
  }
}
