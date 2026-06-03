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
import {
  AssetId,
  AssetType,
  LinkType,
  NodeType,
} from "@epanet-js/hydraulic-model";
import { captureWarning } from "src/infra/error-tracking";
import {
  AssetIndexQueries,
  type LinkIndex,
  type NodeIndex,
} from "./asset-index";

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
  linkIds: BinaryData;
  nodeIds: BinaryData;
  linkTypes: BinaryData;
  nodeTypes: BinaryData;
};

export function assetIndexTransferables(b: AssetIndexBuffers): ArrayBuffer[] {
  return [b.index, b.linkIds, b.nodeIds, b.linkTypes, b.nodeTypes].filter(
    (buf): buf is ArrayBuffer => buf instanceof ArrayBuffer,
  );
}

export class AssetIndexEncoder {
  private indexBuilder: FixedSizeBufferBuilder<AssetIndexEntry>;
  private linkIdsBuilder: FixedSizeBufferBuilder<AssetId>;
  private nodeIdsBuilder: FixedSizeBufferBuilder<AssetId>;
  private linkTypesBufferBuilder: FixedSizeBufferBuilder<LinkType>;
  private nodeTypesBufferBuilder: FixedSizeBufferBuilder<NodeType>;

  constructor(
    private assetIndex: AssetIndexQueries,
    bufferType: BufferType = "array",
  ) {
    const reportedMaxId = this.assetIndex.maxAssetId;
    let observedMaxId = 0;
    for (const [id] of this.assetIndex.iterateLinks()) {
      if (id > observedMaxId) observedMaxId = id;
    }
    for (const [id] of this.assetIndex.iterateNodes()) {
      if (id > observedMaxId) observedMaxId = id;
    }
    if (observedMaxId > reportedMaxId) {
      captureWarning(
        `AssetIndexEncoder: maxAssetId out of sync with index ` +
          `(observed=${observedMaxId} reported=${reportedMaxId} ` +
          `linkCount=${this.assetIndex.linkCount} nodeCount=${this.assetIndex.nodeCount})`,
      );
    }
    const safeMaxId = Math.max(reportedMaxId, observedMaxId);

    this.indexBuilder = new FixedSizeBufferBuilder<AssetIndexEntry>(
      ASSET_INDEX_SIZE,
      safeMaxId + 1,
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
    this.linkIdsBuilder = new FixedSizeBufferBuilder<AssetId>(
      ASSET_INDEX_SIZE,
      assetIndex.linkCount,
      bufferType,
      encodeNumber,
    );
    this.nodeIdsBuilder = new FixedSizeBufferBuilder<AssetId>(
      ASSET_INDEX_SIZE,
      assetIndex.nodeCount,
      bufferType,
      encodeNumber,
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
    this.indexBuilder.addAtIndex(id, [ASSET_TYPE_LINK, index + 1]);
    this.linkIdsBuilder.addAtIndex(index, id);
    this.linkTypesBufferBuilder.addAtIndex(index, assetType);
  }

  encodeNode(id: AssetId, index: NodeIndex): void {
    const assetType = this.assetIndex.getNodeType(id);
    if (assetType === undefined) {
      throw new Error(`Node ${id} not found in assets`);
    }
    // Add 1 to bufferIndex to ensure consistency on link and node indexes
    this.indexBuilder.addAtIndex(id, [ASSET_TYPE_NODE, index + 1]);
    this.nodeIdsBuilder.addAtIndex(index, id);
    this.nodeTypesBufferBuilder.addAtIndex(index, assetType);
  }

  finalize(): AssetIndexBuffers {
    return {
      index: this.indexBuilder.finalize(),
      linkIds: this.linkIdsBuilder.finalize(),
      nodeIds: this.nodeIdsBuilder.finalize(),
      linkTypes: this.linkTypesBufferBuilder.finalize(),
      nodeTypes: this.nodeTypesBufferBuilder.finalize(),
    };
  }
}

export class AssetIndexView implements AssetIndexQueries {
  private indexView: FixedSizeBufferView<AssetIndexEntry | null>;
  private linkIdsView: FixedSizeBufferView<AssetId>;
  private nodeIdsView: FixedSizeBufferView<AssetId>;
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
    this.linkIdsView = new FixedSizeBufferView(
      buffers.linkIds,
      ASSET_INDEX_SIZE,
      decodeNumber,
    );
    this.nodeIdsView = new FixedSizeBufferView(
      buffers.nodeIds,
      ASSET_INDEX_SIZE,
      decodeNumber,
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

  getNodeId(index: NodeIndex): AssetId | null {
    if (index < 0 || index >= this.nodeCount) return null;
    return this.nodeIdsView.getById(index);
  }

  getLinkId(index: NodeIndex): AssetId | null {
    if (index < 0 || index >= this.linkCount) return null;
    return this.linkIdsView.getById(index);
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
