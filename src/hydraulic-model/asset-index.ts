import {
  BinaryData,
  BufferType,
  DataSize,
  encodeNumber,
  decodeNumber,
  encodeType,
  decodeType,
  FixedSizeBufferView,
  FixedSizeBufferBuilder,
} from "src/lib/buffers";
import { AssetId, AssetType, LinkType, NodeType } from "./asset-types";
import { IdGenerator } from "./id-generator";
import { AssetsMap } from "./assets-map";

export interface AssetIndexQueries {
  get linkCount(): number;
  get nodeCount(): number;
  get maxAssetId(): number;
  hasLink(id: AssetId): boolean;
  hasNode(id: AssetId): boolean;
  iterateLinks(): Generator<[AssetId, LinkIndex], void, unknown>;
  iterateNodes(): Generator<[AssetId, NodeIndex], void, unknown>;
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
}

const ASSET_TYPE_LINK = 0;
const ASSET_TYPE_NODE = 1;
const EMPTY_ASSET_INDEX = 0;
const ASSET_INDEX_SIZE = DataSize.number;
const ASSET_INDEX_BIT_ENCODING_MASK = 0x7fffffff;
const ASSET_INDEX_CUSTOM_HEADER_SIZE = DataSize.number * 2; // linkCount + nodeCount
const ASSET_TYPE_SIZE = DataSize.type;

const NODE_TYPE_MAP = { junction: 1, tank: 2, reservoir: 3 } as const;

const NODE_TYPE_REVERSE_MAP: Record<number, NodeType> = {
  [NODE_TYPE_MAP.junction]: "junction",
  [NODE_TYPE_MAP.tank]: "tank",
  [NODE_TYPE_MAP.reservoir]: "reservoir",
} as const;

function toNodeTypeId(type: NodeType) {
  return NODE_TYPE_MAP[type];
}

function toNodeType(typeId: number): NodeType {
  return NODE_TYPE_REVERSE_MAP[typeId];
}

const LINK_TYPE_MAP = { pipe: 1, valve: 2, pump: 3 } as const;

const LINK_TYPE_REVERSE_MAP: Record<number, LinkType> = {
  [LINK_TYPE_MAP.pipe]: "pipe",
  [LINK_TYPE_MAP.valve]: "valve",
  [LINK_TYPE_MAP.pump]: "pump",
} as const;

function toLinkTypeId(type: LinkType) {
  return LINK_TYPE_MAP[type];
}

function toLinkType(typeId: number): LinkType {
  return LINK_TYPE_REVERSE_MAP[typeId];
}

function encodeLinkType(type: LinkType, offset: number, view: DataView) {
  const linkTypeId = toLinkTypeId(type);
  encodeType(linkTypeId, offset, view);
}

function encodeNodeType(type: NodeType, offset: number, view: DataView) {
  const nodeTypeId = toNodeTypeId(type);
  encodeType(nodeTypeId, offset, view);
}

function decodeLinkType(offset: number, view: DataView): LinkType | undefined {
  const linkTypeId = decodeType(offset, view);
  return toLinkType(linkTypeId);
}

function decodeNodeType(offset: number, view: DataView): NodeType | undefined {
  const nodeTypeId = decodeType(offset, view);
  return toNodeType(nodeTypeId);
}

type BufferIndex = number;
type LinkIndex = number;
type NodeIndex = number;

type AssetIndexEntry = [
  typeof ASSET_TYPE_LINK | typeof ASSET_TYPE_NODE,
  BufferIndex,
];

function encodeAssetIndex(
  [type, index]: AssetIndexEntry,
  offset: number,
  view: DataView,
) {
  const bitEncodedValue =
    (type << 31) | (index & ASSET_INDEX_BIT_ENCODING_MASK);
  encodeNumber(bitEncodedValue, offset, view);
}

function decodeAssetIndex(
  offset: number,
  view: DataView,
): AssetIndexEntry | null {
  const bitEncodedValue = decodeNumber(offset, view);
  if (bitEncodedValue === EMPTY_ASSET_INDEX) return null;

  const type = ((bitEncodedValue >>> 31) & 1) as 0 | 1;
  const index = bitEncodedValue & ASSET_INDEX_BIT_ENCODING_MASK;
  return [type, index];
}

function decodeHeader(offset: number, view: DataView) {
  const linkCount = decodeNumber(offset, view);
  const nodeCount = decodeNumber(offset + DataSize.number, view);

  return { linkCount, nodeCount };
}

function encodeHeader(
  linkCount: number,
  nodeCount: number,
  offset: number,
  view: DataView,
) {
  encodeNumber(linkCount, offset, view);
  encodeNumber(nodeCount, offset + DataSize.number, view);
}

export type AssetIndexBuffers = {
  index: BinaryData;
  linkTypes: BinaryData;
  nodeTypes: BinaryData;
};

export class AssetIndexEncoder {
  private bufferBuilder: FixedSizeBufferBuilder<AssetIndexEntry>;
  private linkTypesBufferBuilder: FixedSizeBufferBuilder<LinkType>;
  private nodeTypesBufferBuilder: FixedSizeBufferBuilder<NodeType>;

  constructor(
    private assetIndex: AssetIndexQueries,
    bufferType: BufferType = "array",
  ) {
    this.bufferBuilder = new FixedSizeBufferBuilder<AssetIndexEntry>(
      ASSET_INDEX_SIZE,
      this.assetIndex.maxAssetId + 1,
      bufferType,
      encodeAssetIndex,
      ASSET_INDEX_CUSTOM_HEADER_SIZE,
      (offset, view) =>
        encodeHeader(
          this.assetIndex.linkCount,
          this.assetIndex.nodeCount,
          offset,
          view,
        ),
    );
    this.linkTypesBufferBuilder = new FixedSizeBufferBuilder<LinkType>(
      ASSET_TYPE_SIZE,
      this.assetIndex.linkCount,
      bufferType,
      encodeLinkType,
    );
    this.nodeTypesBufferBuilder = new FixedSizeBufferBuilder<NodeType>(
      ASSET_TYPE_SIZE,
      this.assetIndex.nodeCount,
      bufferType,
      encodeNodeType,
    );
  }

  encode(): AssetIndexBuffers {
    for (const [id, nodeIndex] of this.assetIndex.iterateNodes()) {
      this.encodeNode(id, nodeIndex);
    }
    for (const [id, linkIndex] of this.assetIndex.iterateLinks()) {
      this.encodeLink(id, linkIndex);
    }

    return this.finalize();
  }

  encodeLink(id: AssetId, index: LinkIndex): void {
    const assetType = this.assetIndex.getLinkType(id);
    if (assetType === undefined) {
      throw new Error(`Link ${id} not found in assets`);
    }
    // Add 1 to bufferIndex to ensure encoded value is never 0 (EMPTY_ASSET_INDEX)
    // This is necessary because the first asset gets bufferIndex=0, and
    // encodeAssetIndex(ASSET_TYPE_LINK=0, 0) = 0, which would be indistinguishable from empty
    this.bufferBuilder.addAtIndex(id, [ASSET_TYPE_LINK, index + 1]);
    this.linkTypesBufferBuilder.addAtIndex(index, assetType);
  }

  encodeNode(id: AssetId, index: NodeIndex): void {
    const assetType = this.assetIndex.getNodeType(id);
    if (assetType === undefined) {
      throw new Error(`Node ${id} not found in assets`);
    }
    // Add 1 to bufferIndex to ensure consistency on link and node indexes
    this.bufferBuilder.addAtIndex(id, [ASSET_TYPE_NODE, index + 1]);
    this.nodeTypesBufferBuilder.addAtIndex(index, assetType);
  }

  finalize(): AssetIndexBuffers {
    return {
      index: this.bufferBuilder.finalize(),
      linkTypes: this.linkTypesBufferBuilder.finalize(),
      nodeTypes: this.nodeTypesBufferBuilder.finalize(),
    };
  }
}

export class AssetIndexView implements AssetIndexQueries {
  private indexView: FixedSizeBufferView<AssetIndexEntry | null>;
  private nodeTypesView: FixedSizeBufferView<NodeType | undefined>;
  private linkTypesView: FixedSizeBufferView<LinkType | undefined>;
  private linkCountValue: number = 0;
  private nodeCountValue: number = 0;

  constructor(buffers: AssetIndexBuffers) {
    this.indexView = new FixedSizeBufferView(
      buffers.index,
      ASSET_INDEX_SIZE,
      decodeAssetIndex,
      ASSET_INDEX_CUSTOM_HEADER_SIZE,
      (offset: number, view: DataView) => {
        const { linkCount, nodeCount } = decodeHeader(offset, view);
        this.linkCountValue = linkCount;
        this.nodeCountValue = nodeCount;
      },
    );
    this.nodeTypesView = new FixedSizeBufferView(
      buffers.nodeTypes,
      ASSET_TYPE_SIZE,
      decodeNodeType,
    );
    this.linkTypesView = new FixedSizeBufferView(
      buffers.linkTypes,
      ASSET_TYPE_SIZE,
      decodeLinkType,
    );
  }

  getLinkIndex(id: AssetId): LinkIndex | null {
    if (id <= 0 || id >= this.indexView.count) {
      return null;
    }
    const assetIndex = this.indexView.getById(id);
    if (assetIndex === null) return null;
    const [type, index] = assetIndex;
    if (type !== ASSET_TYPE_LINK) {
      return null;
    }
    // Subtract 1 because we added 1 during encoding to avoid 0 collision
    return index - 1;
  }

  getNodeIndex(id: AssetId): NodeIndex | null {
    if (id <= 0 || id >= this.indexView.count) {
      return null;
    }
    const assetIndex = this.indexView.getById(id);
    if (assetIndex === null) return null;
    const [type, index] = assetIndex;
    if (type !== ASSET_TYPE_NODE) {
      return null;
    }
    // Subtract 1 because we added 1 during encoding to avoid 0 collision
    return index - 1;
  }

  hasLink(id: AssetId): boolean {
    return this.getLinkIndex(id) !== null;
  }

  hasNode(id: AssetId): boolean {
    return this.getNodeIndex(id) !== null;
  }

  *iterateLinks(): Generator<[AssetId, LinkIndex], void, unknown> {
    for (const [id, assetIndexEntry] of this.indexView.enumerate()) {
      if (assetIndexEntry === null) continue;
      const [type, encodedIndex] = assetIndexEntry;
      if (type === ASSET_TYPE_LINK) {
        yield [id, encodedIndex - 1];
      }
    }
  }

  *iterateNodes(): Generator<[AssetId, NodeIndex], void, unknown> {
    for (const [id, assetIndexEntry] of this.indexView.enumerate()) {
      if (assetIndexEntry === null) continue;
      const [type, encodedIndex] = assetIndexEntry;
      if (type === ASSET_TYPE_NODE) {
        yield [id, encodedIndex - 1];
      }
    }
  }

  get linkCount(): number {
    return this.linkCountValue;
  }

  get nodeCount(): number {
    return this.nodeCountValue;
  }

  get maxAssetId(): number {
    return this.indexView.count;
  }

  getAssetType(id: AssetId): AssetType | undefined {
    if (this.hasLink(id)) {
      return this.getLinkType(id);
    }
    return this.getNodeType(id);
  }

  getNodeType(id: AssetId): NodeType | undefined {
    const nodeIndex = this.getNodeIndex(id);
    if (nodeIndex === null) return undefined;
    return this.nodeTypesView.getById(nodeIndex);
  }

  getLinkType(id: AssetId): LinkType | undefined {
    const linkIndex = this.getLinkIndex(id);
    if (linkIndex === null) return undefined;
    return this.linkTypesView.getById(linkIndex);
  }
}
